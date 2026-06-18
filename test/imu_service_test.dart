import 'package:flutter_test/flutter_test.dart';
import 'package:aura_app/services/imu_service.dart';

void main() {
  group('ImuData', () {
    test('constructor sets all fields', () {
      final data = ImuData(x: 1.0, y: 2.0, z: 3.0);
      expect(data.x, equals(1.0));
      expect(data.y, equals(2.0));
      expect(data.z, equals(3.0));
      expect(data.timestamp, isA<DateTime>());
    });

    test('fromMap parses correctly', () {
      final data = ImuData.fromMap({'x': 0.5, 'y': -0.3, 'z': 0.1});
      expect(data.x, equals(0.5));
      expect(data.y, equals(-0.3));
      expect(data.z, equals(0.1));
    });

    test('toString contains formatted values', () {
      final data = ImuData(x: 1.234, y: -0.567, z: 0.0);
      final str = data.toString();
      // ImuData.toString() formats with 3 decimal places
      expect(str, contains('1.234'));
      expect(str, contains('-0.567'));
      expect(str, contains('0.000'));
      expect(str, startsWith('ImuData('));
    });

    test('timestamp can be overridden', () {
      final customTime = DateTime(2025, 1, 1);
      final data = ImuData(x: 0, y: 0, z: 0, timestamp: customTime);
      expect(data.timestamp, equals(customTime));
    });
  });

  group('ImuGesture', () {
    test('all gesture values are distinct', () {
      final values = ImuGesture.values.toSet();
      expect(values.length, equals(ImuGesture.values.length));
    });

    test('contains expected gestures', () {
      expect(ImuGesture.values, contains(ImuGesture.nod));
      expect(ImuGesture.values, contains(ImuGesture.shake));
      expect(ImuGesture.values, contains(ImuGesture.lookDown));
      expect(ImuGesture.values, contains(ImuGesture.lookForward));
      expect(ImuGesture.values, contains(ImuGesture.walking));
      expect(ImuGesture.values, contains(ImuGesture.still));
    });
  });

  group('ImuService', () {
    test('singleton returns same instance', () {
      final a = ImuService.get;
      final b = ImuService.get;
      expect(identical(a, b), isTrue);
    });

    test('initial state is not active', () {
      expect(ImuService.get.isActive, isFalse);
    });
  });
}
