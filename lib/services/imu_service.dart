import 'dart:async';
import 'package:flutter/services.dart';

/// IMU data from G2 smart glasses.
class ImuData {
  final double x;
  final double y;
  final double z;
  final DateTime timestamp;

  const ImuData({
    required this.x,
    required this.y,
    required this.z,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  factory ImuData.fromMap(Map<dynamic, dynamic> map) {
    return ImuData(
      x: (map['x'] as num).toDouble(),
      y: (map['y'] as num).toDouble(),
      z: (map['z'] as num).toDouble(),
    );
  }

  @override
  String toString() =>
      'ImuData(x: ${x.toStringAsFixed(3)}, '
      'y: ${y.toStringAsFixed(3)}, z: ${z.toStringAsFixed(3)})';
}

/// Gesture types detected from IMU data.
enum ImuGesture {
  nod,
  shake,
  lookDown,
  lookForward,
  walking,
  still,
  unknown,
}

/// IMU gesture detection service.
class ImuService {
  static ImuService? _instance;
  static ImuService get get => _instance ??= ImuService._();

  ImuService._();

  static const _channel = MethodChannel('method.imu');

  final StreamController<ImuData> _imuController =
      StreamController<ImuData>.broadcast();
  final StreamController<ImuGesture> _gestureController =
      StreamController<ImuGesture>.broadcast();

  Stream<ImuData> get imuStream => _imuController.stream;
  Stream<ImuGesture> get gestureStream => _gestureController.stream;

  bool _isActive = false;
  bool get isActive => _isActive;

  static const double _nodThreshold = 0.5;
  static const double _shakeThreshold = 0.5;
  static const double _lookDownPitch = 0.7;
  static const double _walkingVariance = 0.3;

  final List<ImuData> _buffer = [];
  static const int _bufferSize = 20;
  ImuData? _lastSample;
  StreamSubscription? _imuEventSubscription;

  Future<bool> startStreaming() async {
    if (_isActive) return true;
    try {
      final result = await _channel.invokeMethod<bool>('startImu');
      _isActive = result ?? true;
      // Cancel any previous subscription to prevent duplicate listeners
      await _imuEventSubscription?.cancel();
      _imuEventSubscription = const EventChannel('eventImu')
          .receiveBroadcastStream('eventImu')
          .listen((event) {
        final imuData =
            ImuData.fromMap(Map<dynamic, dynamic>.from(event as Map));
        _imuController.add(imuData);
        _processGesture(imuData);
      });
      return _isActive;
    } catch (e) {
      print('ImuService: failed to start streaming — $e');
      return false;
    }
  }

  Future<void> stopStreaming() async {
    if (!_isActive) return;
    try {
      await _channel.invokeMethod('stopImu');
      await _imuEventSubscription?.cancel();
      _imuEventSubscription = null;
    } catch (e) {
      print('ImuService: failed to stop streaming — $e');
    } finally {
      _isActive = false;
    }
  }

  void _processGesture(ImuData sample) {
    _buffer.add(sample);
    if (_buffer.length > _bufferSize) {
      _buffer.removeAt(0);
    }
    if (_lastSample == null) {
      _lastSample = sample;
      return;
    }
    final dx = (sample.x - _lastSample!.x).abs();
    final dy = (sample.y - _lastSample!.y).abs();
    _lastSample = sample;
    if (dy > _nodThreshold && dx < _shakeThreshold) {
      _gestureController.add(ImuGesture.nod);
      return;
    }
    if (dx > _shakeThreshold && dy < _nodThreshold) {
      _gestureController.add(ImuGesture.shake);
      return;
    }
    if (sample.y > _lookDownPitch) {
      _gestureController.add(ImuGesture.lookDown);
      return;
    }
    if (sample.y.abs() < 0.2 && sample.x.abs() < 0.2) {
      _gestureController.add(ImuGesture.lookForward);
      return;
    }
    if (_buffer.length >= _bufferSize) {
      final variance = _computeVariance(_buffer);
      if (variance > _walkingVariance) {
        _gestureController.add(ImuGesture.walking);
      } else {
        _gestureController.add(ImuGesture.still);
      }
    }
  }

  double _computeVariance(List<ImuData> samples) {
    if (samples.isEmpty) return 0.0;
    final mean =
        samples.map((s) => s.x + s.y + s.z).reduce((a, b) => a + b) /
            (samples.length * 3);
    final sumSquares = samples
        .map((s) {
          final dx = s.x - mean;
          final dy = s.y - mean;
          final dz = s.z - mean;
          return dx * dx + dy * dy + dz * dz;
        })
        .reduce((a, b) => a + b);
    return sumSquares / (samples.length * 3);
  }

  void dispose() {
    stopStreaming();
    _imuController.close();
    _gestureController.close();
  }
}
