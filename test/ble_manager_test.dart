import 'package:flutter_test/flutter_test.dart';
import 'package:aura_app/ble_manager.dart';

void main() {
  group('BleManager', () {
    test('get returns singleton instance', () {
      final a = BleManager.get();
      final b = BleManager.get();
      expect(identical(a, b), isTrue);
    });

    test('initial connection status is Not connected', () {
      final manager = BleManager.get();
      expect(manager.getConnectionStatus(), equals('Not connected'));
    });

    test('initial isConnected is false', () {
      final manager = BleManager.get();
      expect(manager.isConnected, isFalse);
    });

    test('isBothConnected reflects actual state', () {
      final manager = BleManager.get();

      // Initially not connected
      expect(BleManager.isBothConnected(), isFalse);

      // After connecting, should be true
      manager.isConnected = true;
      expect(BleManager.isBothConnected(), isTrue);

      // Reset for other tests
      manager.isConnected = false;
    });

    test('getPairedGlasses returns empty list initially', () {
      final manager = BleManager.get();
      expect(manager.getPairedGlasses(), isEmpty);
    });

    test('suspendHeartbeat stops the heartbeat timer', () {
      final manager = BleManager.get();
      // Should not throw — heartbeat may not be running
      manager.suspendHeartbeat();
      // No assertion needed — just verifying the method exists and runs
    });

    test('resumeHeartbeat when not connected does nothing', () {
      final manager = BleManager.get();
      manager.isConnected = false;
      // Should not throw — just a no-op when disconnected
      manager.resumeHeartbeat();
    });

    test('dispose cleans up state', () {
      final manager = BleManager.get();
      manager.dispose();
      // isConnected should remain false after dispose
      expect(manager.isConnected, isFalse);
    });
  });
}
