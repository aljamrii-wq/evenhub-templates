/// Aura Engine WebSocket protocol models.
///
/// Mirrors the backend contract in `engine/hermes_bridge.py` and
/// `engine/main.py`.
library;

const int auraProtocolVersion = 1;

String normalizeAuraMode(String mode) {
  switch (mode) {
    case 'flydubai':
    case 'aljamri':
    case 'personal':
      return mode;
    case 'chat':
    default:
      return 'personal';
  }
}

/// Client -> server HELLO frame.
class WsHelloRequest {
  final int version;
  final String client;
  final Map<String, dynamic> capabilities;

  const WsHelloRequest({
    this.version = auraProtocolVersion,
    this.client = 'aura-flutter',
    this.capabilities = const {},
  });

  Map<String, dynamic> toJson() => {
        'type': 'hello',
        'version': version,
        'client': client,
        'capabilities': capabilities,
      };
}

/// Client -> server query frame.
class WsQueryRequest {
  final String payload;
  final String mode;

  const WsQueryRequest({
    required this.payload,
    this.mode = 'personal',
  });

  Map<String, dynamic> toJson() => {
        'type': 'query',
        'payload': payload,
        'mode': normalizeAuraMode(mode),
      };
}

/// Backward-compatible name for older Flutter call sites/tests.
class WsChatRequest extends WsQueryRequest {
  const WsChatRequest({required String query, String mode = 'personal'})
      : super(payload: query, mode: mode);

  String get query => payload;
}

abstract class WsBridgeMessage {
  const WsBridgeMessage();

  String get type;

  static WsBridgeMessage? fromJson(Map<String, dynamic> json) {
    switch (json['type'] as String?) {
      case 'hello_ack':
        return WsHelloAckMessage.fromJson(json);
      case 'hello_error':
        return WsHelloErrorMessage.fromJson(json);
      case 'text':
        return WsTextMessage.fromJson(json);
      case 'bitmap':
        return WsBitmapMessage.fromJson(json);
      case 'error':
        return WsErrorMessage.fromJson(json);
      case 'chunk':
        return WsChunkMessage.fromJson(json);
      case 'done':
        return WsDoneMessage.fromJson(json);
      default:
        return null;
    }
  }
}

class WsHelloAckMessage extends WsBridgeMessage {
  final int version;
  final String server;
  final Map<String, dynamic> capabilities;

  const WsHelloAckMessage({
    required this.version,
    required this.server,
    this.capabilities = const {},
  });

  @override
  String get type => 'hello_ack';

  factory WsHelloAckMessage.fromJson(Map<String, dynamic> json) =>
      WsHelloAckMessage(
        version: json['version'] as int? ?? 0,
        server: json['server'] as String? ?? 'unknown',
        capabilities:
            Map<String, dynamic>.from(json['capabilities'] as Map? ?? {}),
      );
}

class WsHelloErrorMessage extends WsBridgeMessage {
  final int version;
  final String error;
  final List<int> supportedVersions;

  const WsHelloErrorMessage({
    required this.version,
    required this.error,
    this.supportedVersions = const [],
  });

  @override
  String get type => 'hello_error';

  factory WsHelloErrorMessage.fromJson(Map<String, dynamic> json) =>
      WsHelloErrorMessage(
        version: json['version'] as int? ?? 0,
        error: json['error'] as String? ?? 'Unsupported protocol version',
        supportedVersions:
            (json['supported_versions'] as List<dynamic>? ?? const [])
                .whereType<int>()
                .toList(),
      );
}

class WsTextMessage extends WsBridgeMessage {
  final String payload;

  const WsTextMessage({required this.payload});

  @override
  String get type => 'text';

  factory WsTextMessage.fromJson(Map<String, dynamic> json) =>
      WsTextMessage(payload: json['payload'] as String? ?? '');
}

class WsBitmapMessage extends WsBridgeMessage {
  final String payload;

  const WsBitmapMessage({required this.payload});

  @override
  String get type => 'bitmap';

  factory WsBitmapMessage.fromJson(Map<String, dynamic> json) =>
      WsBitmapMessage(payload: json['payload'] as String? ?? '');
}

class WsErrorMessage extends WsBridgeMessage {
  final String message;

  const WsErrorMessage({required this.message});

  @override
  String get type => 'error';

  factory WsErrorMessage.fromJson(Map<String, dynamic> json) => WsErrorMessage(
        message: (json['payload'] as String?) ??
            (json['message'] as String?) ??
            'Unknown error',
      );
}

/// Legacy streaming chunk frame accepted for older Hermes bridge drafts.
class WsChunkMessage extends WsBridgeMessage {
  final String text;

  const WsChunkMessage({required this.text});

  @override
  String get type => 'chunk';

  factory WsChunkMessage.fromJson(Map<String, dynamic> json) =>
      WsChunkMessage(text: json['text'] as String? ?? '');
}

/// Legacy stream-complete frame accepted for older Hermes bridge drafts.
class WsDoneMessage extends WsBridgeMessage {
  final String text;

  const WsDoneMessage({required this.text});

  @override
  String get type => 'done';

  factory WsDoneMessage.fromJson(Map<String, dynamic> json) =>
      WsDoneMessage(text: json['text'] as String? ?? '');
}

enum WsMessageType {
  hello,
  helloAck,
  helloError,
  query,
  alert,
  modeSwitch,
  text,
  bitmap,
  error,
  chunk,
  done;

  static WsMessageType? fromString(String value) {
    switch (value) {
      case 'hello':
        return hello;
      case 'hello_ack':
        return helloAck;
      case 'hello_error':
        return helloError;
      case 'query':
        return query;
      case 'alert':
        return alert;
      case 'mode_switch':
        return modeSwitch;
      case 'text':
        return text;
      case 'bitmap':
        return bitmap;
      case 'error':
        return error;
      case 'chunk':
        return chunk;
      case 'done':
        return done;
      default:
        return null;
    }
  }
}
