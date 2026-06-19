import 'package:flutter_test/flutter_test.dart';
import 'package:aura_app/services/config_service.dart';

void main() {
  group('AuraConfig', () {
    test('all addresses are non-empty', () {
      expect(AuraConfig.hermesBridgeWsUrl, isNotEmpty);
      expect(AuraConfig.auraEngineHttpBase, isNotEmpty);
      expect(AuraConfig.hermesBridgeWssUrl, isNotEmpty);
      expect(AuraConfig.auraEngineHttpsBase, isNotEmpty);
    });

    test('ws:// URL is plaintext (Tailscale encrypted tunnel)', () {
      expect(AuraConfig.hermesBridgeWsUrl, startsWith('ws://'));
      expect(AuraConfig.auraEngineHttpBase, startsWith('http://'));
    });

    test('wss:// and https:// variants provided for non-Tailscale deploys', () {
      expect(AuraConfig.hermesBridgeWssUrl, startsWith('wss://'));
      expect(AuraConfig.auraEngineHttpsBase, startsWith('https://'));
    });

    test('TLS and non-TLS URLs share same host', () {
      // Both variants should point to the same server
      final wsHost = Uri.parse(AuraConfig.hermesBridgeWsUrl).host;
      final wssHost = Uri.parse(AuraConfig.hermesBridgeWssUrl).host;
      expect(wsHost, equals(wssHost));

      final httpHost = Uri.parse(AuraConfig.auraEngineHttpBase).host;
      final httpsHost = Uri.parse(AuraConfig.auraEngineHttpsBase).host;
      expect(httpHost, equals(httpsHost));
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
      expect(
          AuraConfig.evenAiPaginationInterval.inMilliseconds, greaterThan(0));
      expect(AuraConfig.textPageInterval.inMilliseconds, greaterThan(0));
    });
  });
}
