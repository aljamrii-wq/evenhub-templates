import 'package:flutter_test/flutter_test.dart';
import 'package:aura_app/services/config_service.dart';

void main() {
  group('AuraConfig', () {
    test('all addresses are non-empty', () {
      expect(AuraConfig.hermesBridgeWsUrl, isNotEmpty);
      expect(AuraConfig.auraEngineHttpBase, isNotEmpty);
    });

    test('hermesBridgeWsUrl starts with ws://', () {
      expect(AuraConfig.hermesBridgeWsUrl, startsWith('ws://'));
    });

    test('auraEngineHttpBase starts with http://', () {
      expect(AuraConfig.auraEngineHttpBase, startsWith('http://'));
    });

    test('BLE constants are positive', () {
      expect(AuraConfig.bleMaxReconnectAttempts, greaterThan(0));
      expect(AuraConfig.bleReconnectDelay.inMilliseconds, greaterThan(0));
      expect(AuraConfig.bleHeartbeatInterval.inMilliseconds, greaterThan(0));
    });

    test('WebSocket constants are positive', () {
      expect(AuraConfig.wsMaxReconnectAttempts, greaterThan(0));
      expect(AuraConfig.wsReconnectDelay.inMilliseconds, greaterThan(0));
      expect(AuraConfig.wsConnectTimeout.inMilliseconds, greaterThan(0));
    });

    test('EvenAI recording duration is positive', () {
      expect(AuraConfig.evenAiMaxRecordingDuration, greaterThan(0));
    });

    test('pagination intervals are positive', () {
      expect(AuraConfig.evenAiPaginationInterval.inMilliseconds, greaterThan(0));
      expect(AuraConfig.textPageInterval.inMilliseconds, greaterThan(0));
    });
  });
}
