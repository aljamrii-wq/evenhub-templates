import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:aura_app/models/aura_engine_models.dart';
import 'package:aura_app/services/aura_engine_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Aura Engine WebSocket models', () {
    test('normalizes legacy chat mode to personal', () {
      final request = WsQueryRequest(payload: 'مرحبا', mode: 'chat');
      expect(request.toJson(), {
        'type': 'query',
        'payload': 'مرحبا',
        'mode': 'personal',
      });
    });

    test('parses backend text and error responses', () {
      final text = WsBridgeMessage.fromJson({
        'type': 'text',
        'payload': 'answer',
      });
      final error = WsBridgeMessage.fromJson({
        'type': 'error',
        'payload': 'failed',
      });

      expect(text, isA<WsTextMessage>());
      expect((text as WsTextMessage).payload, 'answer');
      expect(error, isA<WsErrorMessage>());
      expect((error as WsErrorMessage).message, 'failed');
    });
  });

  group('HermesBridgeService', () {
    test('sends hello then query using backend /ws/aura contract', () async {
      final server = await _WsTestServer.start((ws, received) {
        ws.listen((raw) {
          final data = jsonDecode(raw as String) as Map<String, dynamic>;
          received.add(data);
          if (data['type'] == 'hello') {
            ws.add(jsonEncode({
              'type': 'hello_ack',
              'version': 1,
              'server': 'aura-engine',
              'capabilities': {'render': true},
            }));
          } else if (data['type'] == 'query') {
            ws.add(jsonEncode({
              'type': 'text',
              'payload': 'reply: ${data['payload']}',
            }));
          }
        });
      });
      final bridge = HermesBridgeService(wsUrl: server.url);

      try {
        final ackFuture =
            bridge.messageStream.where((m) => m is WsHelloAckMessage).first;
        expect(await bridge.connect(), isTrue);
        final ack = await ackFuture.timeout(const Duration(seconds: 2));
        expect(ack, isA<WsHelloAckMessage>());
        expect(bridge.isReady, isTrue);
        expect(bridge.protocolVersion, 1);

        final textFuture = bridge.textStream.first;
        await bridge.sendChatQuery('ping', mode: 'chat');
        expect(await textFuture.timeout(const Duration(seconds: 2)),
            'reply: ping');

        expect(server.received[0]['type'], 'hello');
        expect(server.received[1], {
          'type': 'query',
          'payload': 'ping',
          'mode': 'personal',
        });
      } finally {
        bridge.dispose();
        await server.close();
      }
    });

    test('emits an error message when connection fails', () async {
      final bridge = HermesBridgeService(wsUrl: 'ws://127.0.0.1:1/ws/aura');
      final errorFuture = bridge.messageStream
          .where((message) => message is WsErrorMessage)
          .cast<WsErrorMessage>()
          .first;

      await bridge.sendChatQuery('ping');
      final error = await errorFuture.timeout(const Duration(seconds: 2));

      expect(error.message, 'Aura Engine: connection failed.');
      bridge.dispose();
    });
  });

  group('AuraTransport', () {
    test('returns WebSocket text response when bridge is available', () async {
      final server = await _WsTestServer.start((ws, _) {
        ws.listen((raw) {
          final data = jsonDecode(raw as String) as Map<String, dynamic>;
          if (data['type'] == 'hello') {
            ws.add(jsonEncode({'type': 'hello_ack', 'version': 1}));
          } else if (data['type'] == 'query') {
            ws.add(jsonEncode({'type': 'text', 'payload': 'ws ok'}));
          }
        });
      });
      final transport = AuraTransport(
        bridge: HermesBridgeService(wsUrl: server.url),
        http: AuraEngineService(baseUrl: 'http://127.0.0.1:1'),
      );

      try {
        expect(await transport.sendChat('ping'), 'ws ok');
      } finally {
        transport.dispose();
        await server.close();
      }
    });

    test('falls back to HTTP when bridge is unavailable', () async {
      final httpServer = await _HttpChatServer.start();
      final transport = AuraTransport(
        bridge: HermesBridgeService(wsUrl: 'ws://127.0.0.1:1/ws/aura'),
        http: AuraEngineService(baseUrl: httpServer.baseUrl),
      );

      try {
        final result = await transport.sendChat('ping', mode: 'flydubai');
        expect(result, 'http ok flydubai');
        expect(httpServer.lastBody, {'query': 'ping', 'mode': 'flydubai'});
      } finally {
        transport.dispose();
        await httpServer.close();
      }
    });
  });
}

typedef WsConnectionHandler = void Function(
  WebSocket socket,
  List<Map<String, dynamic>> received,
);

class _WsTestServer {
  final HttpServer _server;
  final List<Map<String, dynamic>> received;

  _WsTestServer._(this._server, this.received);

  String get url => 'ws://${_server.address.host}:${_server.port}/ws/aura';

  static Future<_WsTestServer> start(WsConnectionHandler handler) async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final received = <Map<String, dynamic>>[];
    server.listen((request) async {
      if (request.uri.path != '/ws/aura') {
        request.response.statusCode = HttpStatus.notFound;
        await request.response.close();
        return;
      }
      final socket = await WebSocketTransformer.upgrade(request);
      handler(socket, received);
    });
    return _WsTestServer._(server, received);
  }

  Future<void> close() => _server.close(force: true);
}

class _HttpChatServer {
  final HttpServer _server;
  Map<String, dynamic>? lastBody;

  _HttpChatServer._(this._server);

  String get baseUrl => 'http://${_server.address.host}:${_server.port}';

  static Future<_HttpChatServer> start() async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final harness = _HttpChatServer._(server);
    server.listen((request) async {
      if (request.uri.path != '/chat') {
        request.response.statusCode = HttpStatus.notFound;
        await request.response.close();
        return;
      }
      final body = await utf8.decoder.bind(request).join();
      harness.lastBody = jsonDecode(body) as Map<String, dynamic>;
      request.response.headers.contentType = ContentType.json;
      request.response.write(jsonEncode({
        'answer': 'http ok ${harness.lastBody!['mode']}',
      }));
      await request.response.close();
    });
    return harness;
  }

  Future<void> close() => _server.close(force: true);
}
