import 'package:aura_app/models/aura_engine_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('WsMessageType', () {
    test('maps backend and legacy frame names', () {
      expect(WsMessageType.fromString('hello_ack'), WsMessageType.helloAck);
      expect(WsMessageType.fromString('query'), WsMessageType.query);
      expect(WsMessageType.fromString('text'), WsMessageType.text);
      expect(WsMessageType.fromString('chunk'), WsMessageType.chunk);
      expect(WsMessageType.fromString('unknown'), isNull);
    });
  });

  group('WsHelloRequest', () {
    test('serializes protocol hello frame', () {
      expect(const WsHelloRequest().toJson(), {
        'type': 'hello',
        'version': 1,
        'client': 'aura-flutter',
        'capabilities': <String, dynamic>{},
      });
    });
  });

  group('WsChatRequest', () {
    test('keeps legacy API but serializes as query payload', () {
      final request = const WsChatRequest(query: 'hello', mode: 'aljamri');
      expect(request.query, 'hello');
      expect(request.toJson(), {
        'type': 'query',
        'payload': 'hello',
        'mode': 'aljamri',
      });
    });
  });
}
