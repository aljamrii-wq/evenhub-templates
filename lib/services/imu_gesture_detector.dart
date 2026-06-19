import 'dart:math' as math;
import 'dart:typed_data';

/// One normalized IMU sample from the G2 glasses.
///
/// The x/y/z values are expressed in g units after parser scaling. They can be
/// sourced from native EventChannel maps or raw Nordic UART payloads.
class ImuSample {
  const ImuSample({
    required this.x,
    required this.y,
    required this.z,
    required this.timestamp,
    this.side,
    this.sequence,
  });

  final double x;
  final double y;
  final double z;
  final DateTime timestamp;
  final String? side;
  final int? sequence;

  bool get isUsable => x.isFinite && y.isFinite && z.isFinite;

  double get pitchDegrees =>
      math.atan2(y, math.sqrt((x * x) + (z * z))) * 180 / math.pi;

  double get rollDegrees => math.atan2(x, z) * 180 / math.pi;
}

/// Converts native BLE/IMU payloads into normalized [ImuSample] objects.
class ImuEventParser {
  const ImuEventParser({
    this.scale = 4096,
    this.expectedCommand,
  });

  /// Raw int16 units per 1 g. G2 firmware variants commonly expose 12-bit to
  /// 14-bit accelerometer ranges; keep this configurable at the integration
  /// boundary rather than baking it into BLE dispatch.
  final double scale;

  /// Optional command byte used when the BLE dispatcher knows the IMU opcode.
  final int? expectedCommand;

  ImuSample? tryParseMap(Map<dynamic, dynamic> payload) {
    final x = _readFiniteDouble(payload['x']);
    final y = _readFiniteDouble(payload['y']);
    final z = _readFiniteDouble(payload['z']);
    if (x == null || y == null || z == null) {
      return null;
    }

    return ImuSample(
      x: x,
      y: y,
      z: z,
      timestamp: _readTimestamp(payload['timestamp']) ?? DateTime.now(),
      side: payload['lr']?.toString() ?? payload['side']?.toString(),
      sequence: _readInt(payload['sequence']),
    );
  }

  ImuSample? tryParseBytes(
    Uint8List bytes, {
    String? side,
    DateTime? timestamp,
  }) {
    if (scale <= 0 || bytes.isEmpty) {
      return null;
    }

    var payloadOffset = 0;
    if (expectedCommand != null) {
      if (bytes.first != expectedCommand) {
        return null;
      }
      payloadOffset = 1;
    }

    final payloadLength = bytes.length - payloadOffset;
    if (payloadLength != 6 && payloadLength != 8) {
      return null;
    }

    final data = ByteData.sublistView(bytes, payloadOffset);
    final hasSequence = payloadLength == 8;
    final axisOffset = hasSequence ? 2 : 0;
    final sequence = hasSequence ? data.getUint16(0, Endian.little) : null;

    return ImuSample(
      x: data.getInt16(axisOffset, Endian.little) / scale,
      y: data.getInt16(axisOffset + 2, Endian.little) / scale,
      z: data.getInt16(axisOffset + 4, Endian.little) / scale,
      timestamp: timestamp ?? DateTime.now(),
      side: side,
      sequence: sequence,
    );
  }

  static double? _readFiniteDouble(dynamic value) {
    final parsed = value is num ? value.toDouble() : double.tryParse('$value');
    if (parsed == null || !parsed.isFinite) {
      return null;
    }
    return parsed;
  }

  static int? _readInt(dynamic value) {
    if (value == null) {
      return null;
    }
    return value is int ? value : int.tryParse('$value');
  }

  static DateTime? _readTimestamp(dynamic value) {
    if (value == null) {
      return null;
    }
    if (value is DateTime) {
      return value;
    }
    if (value is int) {
      return DateTime.fromMillisecondsSinceEpoch(value);
    }
    return DateTime.tryParse('$value');
  }
}

enum ImuGestureType {
  nod,
  shake,
  look,
}

enum ImuLookDirection {
  left,
  right,
  up,
  down,
  forward,
}

class DetectedImuGesture {
  const DetectedImuGesture({
    required this.type,
    required this.timestamp,
    required this.confidence,
    this.lookDirection,
  });

  final ImuGestureType type;
  final DateTime timestamp;
  final double confidence;
  final ImuLookDirection? lookDirection;
}

class ImuGestureDetectorConfig {
  const ImuGestureDetectorConfig({
    this.window = const Duration(milliseconds: 650),
    this.debounce = const Duration(milliseconds: 450),
    this.nodAxisRange = 0.78,
    this.shakeAxisRange = 0.78,
    this.crossAxisLimit = 0.44,
    this.lookAxisThreshold = 0.58,
    this.lookReturnThreshold = 0.18,
    this.minimumMotionSamples = 3,
    this.minimumLookSamples = 2,
  });

  final Duration window;
  final Duration debounce;
  final double nodAxisRange;
  final double shakeAxisRange;
  final double crossAxisLimit;
  final double lookAxisThreshold;
  final double lookReturnThreshold;
  final int minimumMotionSamples;
  final int minimumLookSamples;
}

/// Stateful gesture detector for nod, shake, and look gestures.
///
/// Feed samples in timestamp order. A gesture is returned only when a window has
/// enough evidence and the debounce interval has elapsed.
class ImuGestureDetector {
  ImuGestureDetector({
    ImuGestureDetectorConfig config = const ImuGestureDetectorConfig(),
  }) : _config = config;

  final ImuGestureDetectorConfig _config;
  final List<ImuSample> _samples = [];
  DateTime? _lastGestureAt;

  DetectedImuGesture? addSample(ImuSample sample) {
    if (!sample.isUsable) {
      return null;
    }

    _samples.add(sample);
    _trim(sample.timestamp);

    if (_isDebounced(sample.timestamp)) {
      return null;
    }

    final motion = _detectMotionGesture(sample);
    if (motion != null) {
      _lastGestureAt = motion.timestamp;
      _samples.clear();
      _samples.add(sample);
      return motion;
    }

    final look = _detectLookGesture(sample);
    if (look != null) {
      _lastGestureAt = look.timestamp;
      return look;
    }

    return null;
  }

  void reset() {
    _samples.clear();
    _lastGestureAt = null;
  }

  bool _isDebounced(DateTime timestamp) {
    final last = _lastGestureAt;
    return last != null && timestamp.difference(last) < _config.debounce;
  }

  DetectedImuGesture? _detectMotionGesture(ImuSample current) {
    if (_samples.length < _config.minimumMotionSamples) {
      return null;
    }

    final xRange = _axisRange((sample) => sample.x);
    final yRange = _axisRange((sample) => sample.y);
    final xCrossesCenter = _crossesCenter((sample) => sample.x);
    final yCrossesCenter = _crossesCenter((sample) => sample.y);

    if (yRange >= _config.nodAxisRange &&
        xRange <= _config.crossAxisLimit &&
        yCrossesCenter) {
      return DetectedImuGesture(
        type: ImuGestureType.nod,
        timestamp: current.timestamp,
        confidence: _confidence(yRange, _config.nodAxisRange),
      );
    }

    if (xRange >= _config.shakeAxisRange &&
        yRange <= _config.crossAxisLimit &&
        xCrossesCenter) {
      return DetectedImuGesture(
        type: ImuGestureType.shake,
        timestamp: current.timestamp,
        confidence: _confidence(xRange, _config.shakeAxisRange),
      );
    }

    return null;
  }

  DetectedImuGesture? _detectLookGesture(ImuSample current) {
    if (_samples.length < _config.minimumLookSamples) {
      return null;
    }

    final recent = _samples.reversed.take(_config.minimumLookSamples).toList();
    final direction = _lookDirection(recent);
    if (direction == null) {
      return null;
    }

    final axisValue = direction == ImuLookDirection.left ||
            direction == ImuLookDirection.right
        ? current.x.abs()
        : current.y.abs();

    return DetectedImuGesture(
      type: ImuGestureType.look,
      lookDirection: direction,
      timestamp: current.timestamp,
      confidence: _confidence(axisValue, _config.lookAxisThreshold),
    );
  }

  ImuLookDirection? _lookDirection(List<ImuSample> samples) {
    final avgX = _average(samples, (sample) => sample.x);
    final avgY = _average(samples, (sample) => sample.y);

    if (avgY >= _config.lookAxisThreshold) {
      return ImuLookDirection.down;
    }
    if (avgY <= -_config.lookAxisThreshold) {
      return ImuLookDirection.up;
    }
    if (avgX >= _config.lookAxisThreshold) {
      return ImuLookDirection.right;
    }
    if (avgX <= -_config.lookAxisThreshold) {
      return ImuLookDirection.left;
    }
    return null;
  }

  void _trim(DateTime now) {
    _samples.removeWhere(
      (sample) => now.difference(sample.timestamp) > _config.window,
    );
  }

  double _axisRange(double Function(ImuSample sample) read) {
    final values = _samples.map(read);
    final max = values.reduce((a, b) => a > b ? a : b);
    final min = values.reduce((a, b) => a < b ? a : b);
    return max - min;
  }

  bool _crossesCenter(double Function(ImuSample sample) read) {
    var hasPositive = false;
    var hasNegative = false;

    for (final sample in _samples) {
      final value = read(sample);
      if (value > _config.lookReturnThreshold) {
        hasPositive = true;
      } else if (value < -_config.lookReturnThreshold) {
        hasNegative = true;
      }
    }

    return hasPositive && hasNegative;
  }

  static double _average(
    List<ImuSample> samples,
    double Function(ImuSample sample) read,
  ) {
    return samples.map(read).reduce((a, b) => a + b) / samples.length;
  }

  static double _confidence(double observed, double threshold) {
    return (observed / (threshold * 1.8)).clamp(0.0, 1.0).toDouble();
  }
}
