import 'dart:convert';
import 'dart:io';

import 'package:aura_app/services/aura_engine_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AuraEngineService', () {
    test('returns answer on 200 response', () async {
      final server = await _HttpChatServer.start(
        responseBody: jsonEncode({'answer': 'Hello from engine'}),
      );
      try {
        final service = AuraEngineService(baseUrl: server.baseUrl);
        final result = await service.sendChatRequest('hello');
        expect(result, equals('Hello from engine'));
      } finally {
        await server.close();
      }
    });

    test('returns text field when answer key is missing', () async {
      final server = await _HttpChatServer.start(
        responseBody: jsonEncode({'text': 'Plain text response'}),
      );
      try {
        final service = AuraEngineService(baseUrl: server.baseUrl);
        final result = await service.sendChatRequest('query');
        expect(result, equals('Plain text response'));
      } finally {
        await server.close();
      }
    });

    test('returns body as string when no json keys match', () async {
      final server = await _HttpChatServer.start(responseBody: 'raw response text');
      try {
        final service = AuraEngineService(baseUrl: server.baseUrl);
        final result = await service.sendChatRequest('query');
        expect(result, equals('raw response text'));
      } finally {
        await server.close();
      }
    });

    test('returns error message on non-200 status', () async {
      final server = await _HttpChatServer.start(
        statusCode: 500,
        responseBody: 'Internal Server Error',
      );
      try {
        final service = AuraEngineService(baseUrl: server.baseUrl);
        final result = await service.sendChatRequest('query');
        expect(result, contains('500'));
      } finally {
        await server.close();
      }
    });

    test('includes mode parameter in request', () async {
      final server = await _HttpChatServer.start(
        responseBuilder: (body) => jsonEncode({
          'answer': 'mode ${body['mode']}',
        }),
      );
      try {
        final service = AuraEngineService(baseUrl: server.baseUrl);
        final result = await service.sendChatRequest('query', mode: 'flydubai');
        expect(result, equals('mode flydubai'));
        expect(server.lastBody, {'query': 'query', 'mode': 'flydubai'});
      } finally {
        await server.close();
      }
    });
  });

  group('HermesBridgeService', () {
    test('isConnected is false on construction', () {
      final bridge = HermesBridgeService();
      expect(bridge.isConnected, isFalse);
    });

    test('textStream is a broadcast stream', () {
      final bridge = HermesBridgeService();
      expect(bridge.textStream.isBroadcast, isTrue);
    });

    test('disconnect prevents reconnect', () async {
      final bridge = HermesBridgeService();
      await bridge.disconnect();
      expect(bridge.isConnected, isFalse);
    });

    test('dispose cleans up resources', () {
      final bridge = HermesBridgeService();
      bridge.dispose();
      expect(bridge.isConnected, isFalse);
    });
  });

  group('AuraTransport', () {
    test('falls back to HTTP when bridge is unavailable', () async {
      final server = await _HttpChatServer.start(
        responseBody: jsonEncode({'answer': 'HTTP response'}),
      );
      final transport = AuraTransport(
        bridge: HermesBridgeService(wsUrl: 'ws://127.0.0.1:1/ws/aura'),
        http: AuraEngineService(baseUrl: server.baseUrl),
      );
      try {
        final result = await transport.sendChat('test query');
        expect(result, equals('HTTP response'));
      } finally {
        transport.dispose();
        await server.close();
      }
    });

    test('can be constructed with defaults', () {
      final transport = AuraTransport();
      expect(transport.bridge, isA<HermesBridgeService>());
      expect(transport.http, isA<AuraEngineService>());
    });

    test('dispose cleans up bridge', () {
      final transport = AuraTransport();
      transport.dispose();
      expect(transport.bridge.isConnected, isFalse);
    });
  });
}

typedef _ResponseBuilder = String Function(Map<String, dynamic> body);

class _HttpChatServer {
  final HttpServer _server;
  final int statusCode;
  final String responseBody;
  final _ResponseBuilder? responseBuilder;
  Map<String, dynamic>? lastBody;

  _HttpChatServer._(
    this._server, {
    required this.statusCode,
    required this.responseBody,
    this.responseBuilder,
  });

  String get baseUrl => 'http://${_server.address.host}:${_server.port}';

  static Future<_HttpChatServer> start({
    int statusCode = 200,
    String responseBody = '',
    _ResponseBuilder? responseBuilder,
  }) async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final harness = _HttpChatServer._(
      server,
      statusCode: statusCode,
      responseBody: responseBody,
      responseBuilder: responseBuilder,
    );
    server.listen(harness._handleRequest);
    return harness;
  }

  Future<void> _handleRequest(HttpRequest request) async {
    if (request.uri.path != '/chat') {
      request.response.statusCode = HttpStatus.notFound;
      await request.response.close();
      return;
    }

    final rawBody = await utf8.decoder.bind(request).join();
    lastBody = jsonDecode(rawBody) as Map<String, dynamic>;
    request.response.statusCode = statusCode;
    request.response.headers.contentType = ContentType.json;
    request.response.write(responseBuilder?.call(lastBody!) ?? responseBody);
    await request.response.close();
  }

  Future<void> close() => _server.close(force: true);
}
