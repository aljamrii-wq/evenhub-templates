import 'dart:convert';

import 'package:aura_app/localization/aura_app_strings.dart';
import 'package:aura_app/models/even_hub_bridge_message.dart';
import 'package:aura_app/services/even_hub_bridge.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('EvenHubBridgeMessage', () {
    test('parses typed bridge message from JSON', () {
      final message = EvenHubBridgeMessage.fromJsonString(jsonEncode({
        'id': '1',
        'action': 'textContainerUpgrade',
        'payload': {'text': 'مرحبا'},
      }));

      expect(message.id, '1');
      expect(message.action, EvenHubBridgeAction.textContainerUpgrade);
      expect(message.payload['text'], 'مرحبا');
    });

    test('rejects malformed payloads', () {
      expect(
        () => EvenHubBridgeMessage.fromJsonString(jsonEncode({
          'id': '1',
          'action': 'ready',
          'payload': ['bad'],
        })),
        throwsFormatException,
      );
    });
  });

  group('EvenHubBridge', () {
    test('dispatches typed text upgrade handler', () async {
      final bridge = EvenHubBridge(
        handlers: EvenHubBridgeHandlers(
          onTextContainerUpgrade: (payload) => {
            'accepted': true,
            'text': payload['text'],
          },
        ),
      );

      final response = await bridge.handleJsonMessage(jsonEncode({
        'id': 'text-1',
        'action': 'textContainerUpgrade',
        'payload': {'text': 'Hello'},
      }));

      expect(response.ok, isTrue);
      expect(response.id, 'text-1');
      expect(response.payload['accepted'], isTrue);
      expect(response.payload['text'], 'Hello');
    });

    test('returns stable device info fallback', () async {
      final bridge = EvenHubBridge();

      final response = await bridge.handleJsonMessage(jsonEncode({
        'id': 'device-1',
        'action': 'getDeviceInfo',
        'payload': {},
      }));

      expect(response.ok, isTrue);
      expect(response.payload['platform'], 'aura_flutter');
      expect(response.payload['bridge'], 'even_hub_webview');
    });
  });

  group('AuraAppStrings', () {
    test('provides Arabic strings with RTL direction', () {
      final strings = AuraAppStrings.of(const Locale('ar'));

      expect(strings.textDirection, TextDirection.rtl);
      expect(strings.evenHubAppTitle, contains('إيفن'));
      expect(strings.evenHubSampleBody, contains('تجريبية'));
    });
  });
}
