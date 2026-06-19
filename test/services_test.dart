import 'package:flutter_test/flutter_test.dart';
import 'package:aura_app/services/ble.dart';

void main() {
  group('BleUuids', () {
    test('Nordic UART Service UUID is correct', () {
      expect(
        BleUuids.uartService,
        equals('6E400001-B5A3-F393-E0A9-E50E24DCCA9E'),
      );
    });

    test('TX characteristic UUID is correct', () {
      expect(
        BleUuids.uartTx,
        equals('6E400002-B5A3-F393-E0A9-E50E24DCCA9E'),
      );
    });

    test('RX characteristic UUID is correct', () {
      expect(
        BleUuids.uartRx,
        equals('6E400003-B5A3-F393-E0A9-E50E24DCCA9E'),
      );
    });

    test('UUIDs are all different', () {
      expect(BleUuids.uartService, isNot(equals(BleUuids.uartTx)));
      expect(BleUuids.uartService, isNot(equals(BleUuids.uartRx)));
      expect(BleUuids.uartTx, isNot(equals(BleUuids.uartRx)));
    });
  });

  group('BleReceive', () {
    test('default values are correct', () {
      final receive = BleReceive();
      expect(receive.lr, equals(''));
      expect(receive.data, isEmpty);
      expect(receive.type, equals(''));
      expect(receive.isTimeout, isFalse);
    });

    test('getCmd returns first byte', () {
      final receive = BleReceive();
      // Simulate by setting data directly (normally comes from BLE)
      expect(receive.getCmd(), equals(0)); // empty data = 0
    });

    test('fromMap constructs correctly', () {
      final receive = BleReceive.fromMap({
        'lr': 'L',
        'data': [0x25, 0x06, 0x00],
        'type': 'ble',
      });
      expect(receive.lr, equals('L'));
      expect(receive.type, equals('ble'));
    });
  });
}
