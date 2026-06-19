import 'dart:typed_data';

import 'package:aura_app/services/imu_gesture_detector.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ImuEventParser', () {
    test('parses EventChannel map payloads', () {
      final timestamp = DateTime.utc(2026, 6, 19, 9, 30);
      const parser = ImuEventParser();

      final sample = parser.tryParseMap({
        'x': '0.12',
        'y': -0.34,
        'z': 0.98,
        'timestamp': timestamp.toIso8601String(),
        'lr': 'L',
        'sequence': '42',
      });

      expect(sample, isNotNull);
      expect(sample!.x, closeTo(0.12, 0.0001));
      expect(sample.y, closeTo(-0.34, 0.0001));
      expect(sample.z, closeTo(0.98, 0.0001));
      expect(sample.timestamp, equals(timestamp));
      expect(sample.side, equals('L'));
      expect(sample.sequence, equals(42));
    });

    test('parses command-prefixed BLE int16 payloads', () {
      final bytes = _imuPacket(
        command: 0xF6,
        sequence: 7,
        x: 2048,
        y: -1024,
        z: 4096,
      );
      const parser = ImuEventParser(expectedCommand: 0xF6);

      final sample = parser.tryParseBytes(
        bytes,
        side: 'R',
        timestamp: DateTime.utc(2026, 6, 19),
      );

      expect(sample, isNotNull);
      expect(sample!.x, closeTo(0.5, 0.0001));
      expect(sample.y, closeTo(-0.25, 0.0001));
      expect(sample.z, closeTo(1.0, 0.0001));
      expect(sample.sequence, equals(7));
      expect(sample.side, equals('R'));
    });

    test('ignores malformed packets', () {
      const parser = ImuEventParser(expectedCommand: 0xF6);

      expect(parser.tryParseBytes(Uint8List.fromList([])), isNull);
      expect(
        parser.tryParseBytes(Uint8List.fromList([0xF5, 0, 1, 2, 3, 4, 5])),
        isNull,
      );
      expect(parser.tryParseBytes(Uint8List.fromList([0xF6, 0, 1])), isNull);
      expect(parser.tryParseMap({'x': 0, 'y': double.nan, 'z': 1}), isNull);
    });
  });

  group('ImuGestureDetector', () {
    test('detects nod from vertical axis reversal', () {
      final detector = ImuGestureDetector();
      final t = DateTime.utc(2026, 6, 19, 10);

      expect(detector.addSample(_sample(y: -0.45, at: t)), isNull);
      expect(
        detector.addSample(
          _sample(y: 0.05, at: t.add(const Duration(milliseconds: 80))),
        ),
        isNull,
      );

      final gesture = detector.addSample(
        _sample(y: 0.46, at: t.add(const Duration(milliseconds: 160))),
      );

      expect(gesture, isNotNull);
      expect(gesture!.type, equals(ImuGestureType.nod));
      expect(gesture.confidence, greaterThan(0.5));
    });

    test('detects shake from horizontal axis reversal', () {
      final detector = ImuGestureDetector();
      final t = DateTime.utc(2026, 6, 19, 10, 1);

      detector.addSample(_sample(x: -0.48, at: t));
      detector.addSample(
        _sample(x: 0.02, at: t.add(const Duration(milliseconds: 70))),
      );
      final gesture = detector.addSample(
        _sample(x: 0.47, at: t.add(const Duration(milliseconds: 140))),
      );

      expect(gesture, isNotNull);
      expect(gesture!.type, equals(ImuGestureType.shake));
    });

    test('detects sustained look direction without treating one spike as look', () {
      final detector = ImuGestureDetector();
      final t = DateTime.utc(2026, 6, 19, 10, 2);

      expect(detector.addSample(_sample(x: 0.7, at: t)), isNull);
      final gesture = detector.addSample(
        _sample(x: 0.68, at: t.add(const Duration(milliseconds: 90))),
      );

      expect(gesture, isNotNull);
      expect(gesture!.type, equals(ImuGestureType.look));
      expect(gesture.lookDirection, equals(ImuLookDirection.right));
    });

    test('debounces repeated gestures', () {
      final detector = ImuGestureDetector();
      final t = DateTime.utc(2026, 6, 19, 10, 3);

      detector.addSample(_sample(y: -0.45, at: t));
      detector.addSample(
        _sample(y: 0.46, at: t.add(const Duration(milliseconds: 120))),
      );
      final first = detector.addSample(
        _sample(y: -0.44, at: t.add(const Duration(milliseconds: 220))),
      );

      detector.addSample(
        _sample(y: 0.46, at: t.add(const Duration(milliseconds: 300))),
      );
      final second = detector.addSample(
        _sample(y: -0.45, at: t.add(const Duration(milliseconds: 360))),
      );

      expect(first, isNotNull);
      expect(second, isNull);
    });

    test('does not emit false positives for low-amplitude noise', () {
      final detector = ImuGestureDetector();
      final t = DateTime.utc(2026, 6, 19, 10, 4);

      for (var i = 0; i < 8; i++) {
        final gesture = detector.addSample(
          _sample(
            x: i.isEven ? 0.11 : -0.10,
            y: i.isEven ? -0.09 : 0.12,
            at: t.add(Duration(milliseconds: i * 70)),
          ),
        );
        expect(gesture, isNull);
      }
    });
  });
}

ImuSample _sample({
  double x = 0,
  double y = 0,
  double z = 1,
  required DateTime at,
}) {
  return ImuSample(x: x, y: y, z: z, timestamp: at);
}

Uint8List _imuPacket({
  required int command,
  required int sequence,
  required int x,
  required int y,
  required int z,
}) {
  final data = ByteData(9);
  data.setUint8(0, command);
  data.setUint16(1, sequence, Endian.little);
  data.setInt16(3, x, Endian.little);
  data.setInt16(5, y, Endian.little);
  data.setInt16(7, z, Endian.little);
  return data.buffer.asUint8List();
}
