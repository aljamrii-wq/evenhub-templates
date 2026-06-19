import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:aura_app/models/aura_engine_models.dart';
import 'package:aura_app/services/config_service.dart';

/// Hermes Bridge WebSocket client for real-time Aura Engine communication.
///
/// Connects to the Hermes bridge running on the server (Tailscale IP)
/// and streams responses back to the glasses in real-time.
///
/// Protocol: JSON over WebSocket
///   -> { "type": "hello", "version": 1, "client": "aura-flutter" }
///   <- { "type": "hello_ack", "version": 1, "server": "aura-engine" }
///   -> { "type": "query", "payload": "...", "mode": "personal" }
///   <- { "type": "text", "payload": "..." }
///   <- { "type": "error", "payload": "..." }
class HermesBridgeService {
  final String _wsUrl;
  final String? _authToken;
  WebSocket? _ws;
  bool _isConnected = false;
  bool _isReady = false;
  bool _shouldReconnect = true;
  int? _protocolVersion;
  Map<String, dynamic> _serverCapabilities = {};

  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = AuraConfig.wsMaxReconnectAttempts;
  static const Duration _reconnectDelay = AuraConfig.wsReconnectDelay;
  Timer? _reconnectTimer;

  final StreamController<String> _textController =
      StreamController<String>.broadcast();
  final StreamController<WsBridgeMessage> _messageController =
      StreamController<WsBridgeMessage>.broadcast();

  Stream<String> get textStream => _textController.stream;
  Stream<WsBridgeMessage> get messageStream => _messageController.stream;
  bool get isConnected => _isConnected;
  bool get isReady => _isReady;
  int? get protocolVersion => _protocolVersion;
  Map<String, dynamic> get serverCapabilities =>
      Map.unmodifiable(_serverCapabilities);

  HermesBridgeService({
    String? wsUrl,
    String? authToken,
  })  : _wsUrl = wsUrl ?? AuraConfig.hermesBridgeWsUrl,
        _authToken = authToken;

  Future<bool> connect() async {
    if (_isConnected) return true;
    try {
      _shouldReconnect = true;
      final protocols =
          _authToken == null ? null : <String>['aura-token.$_authToken'];
      final headers = _authToken == null
          ? null
          : <String, dynamic>{
              HttpHeaders.authorizationHeader: 'Bearer $_authToken',
              'X-Aura-Token': _authToken,
            };
      _ws = await WebSocket.connect(
        _wsUrl,
        protocols: protocols,
        headers: headers,
      ).timeout(AuraConfig.wsConnectTimeout);
      _isConnected = true;
      _isReady = false;
      _reconnectAttempts = 0;
      _ws!.listen(
        _onMessage,
        onError: _onError,
        onDone: _onDone,
        cancelOnError: false,
      );
      _sendJson(const WsHelloRequest().toJson());
      return true;
    } catch (e) {
      print('HermesBridge: connection failed - $e');
      _scheduleReconnect();
      return false;
    }
  }

  Future<void> sendChatQuery(String query, {String mode = 'personal'}) async {
    if (!_isConnected) {
      final connected = await connect();
      if (!connected) {
        _emitError('Aura Engine: connection failed.');
        return;
      }
    }
    try {
      _sendJson(WsQueryRequest(payload: query, mode: mode).toJson());
    } catch (e) {
      print('HermesBridge: send failed - $e');
      _emitError('Aura Engine: send error.');
      _handleDisconnect();
    }
  }

  Future<void> sendRaw(Map<String, dynamic> data) async {
    if (!_isConnected) {
      final connected = await connect();
      if (!connected) return;
    }
    try {
      _sendJson(data);
    } catch (e) {
      print('HermesBridge: raw send failed - $e');
      _handleDisconnect();
    }
  }

  void _onMessage(dynamic message) {
    try {
      final raw =
          message is List<int> ? utf8.decode(message) : message as String;
      final data = jsonDecode(raw) as Map<String, dynamic>;
      final parsed = WsBridgeMessage.fromJson(data);
      if (parsed == null) return;
      if (parsed is WsHelloAckMessage) {
        _isReady = true;
        _protocolVersion = parsed.version;
        _serverCapabilities = parsed.capabilities;
        _messageController.add(parsed);
        return;
      }
      if (parsed is WsHelloErrorMessage) {
        _isReady = false;
        _messageController.add(parsed);
        _textController.add('Error: ${parsed.error}');
        return;
      }
      _messageController.add(parsed);
      if (parsed is WsTextMessage) {
        _textController.add(parsed.payload);
      } else if (parsed is WsBitmapMessage) {
        _textController.add(parsed.payload);
      } else if (parsed is WsErrorMessage) {
        _textController.add('Error: ${parsed.message}');
      } else if (parsed is WsChunkMessage) {
        _textController.add(parsed.text);
      } else if (parsed is WsDoneMessage) {
        _textController.add(parsed.text);
      }
    } catch (e) {
      print('HermesBridge: failed to parse message - $e');
    }
  }

  void _onError(dynamic error) {
    print('HermesBridge: WebSocket error - $error');
    _handleDisconnect();
  }

  void _onDone() {
    print('HermesBridge: WebSocket closed');
    _handleDisconnect();
  }

  void _handleDisconnect() {
    _isConnected = false;
    _isReady = false;
    _ws = null;
    if (_shouldReconnect) {
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    if (!_shouldReconnect) return;
    if (_reconnectAttempts >= _maxReconnectAttempts) {
      print('HermesBridge: max reconnect attempts reached');
      _textController.add('Aura Engine: connection lost.');
      return;
    }
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(_reconnectDelay, () {
      _reconnectAttempts++;
      print(
          'HermesBridge: reconnecting (attempt $_reconnectAttempts/$_maxReconnectAttempts)...');
      connect();
    });
  }

  Future<void> disconnect() async {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _shouldReconnect = false;
    _reconnectAttempts = _maxReconnectAttempts;
    if (_ws != null) {
      await _ws!.close();
      _ws = null;
    }
    _isConnected = false;
    _isReady = false;
  }

  void dispose() {
    _reconnectTimer?.cancel();
    _shouldReconnect = false;
    _reconnectAttempts = _maxReconnectAttempts;
    _textController.close();
    _messageController.close();
    _ws?.close();
    _ws = null;
    _isConnected = false;
    _isReady = false;
  }

  void _sendJson(Map<String, dynamic> data) {
    _ws!.add(jsonEncode(data));
  }

  void _emitError(String message) {
    final error = WsErrorMessage(message: message);
    _messageController.add(error);
    _textController.add(message);
  }
}

/// HTTP client for Aura Engine (non-streaming fallback).
class AuraEngineService {
  late final String _baseUrl;

  AuraEngineService({String? baseUrl}) {
    _baseUrl = baseUrl ?? AuraConfig.auraEngineHttpBase;
  }

  Future<String> sendChatRequest(String question,
      {String mode = 'chat'}) async {
    final uri = Uri.parse('$_baseUrl/chat');
    final client = HttpClient();
    try {
      final request = await client.postUrl(uri);
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode({
        'query': question,
        'mode': mode,
      }));
      final response = await request.close();
      final body = await response.transform(utf8.decoder).join();
      if (response.statusCode == 200) {
        try {
          final data = jsonDecode(body);
          if (data is Map<String, dynamic>) {
            final answer = data['answer'] ?? data['text'] ?? body;
            return answer.toString();
          }
        } on FormatException {
          return body;
        }
        return body;
      } else {
        print('Aura Engine error: ${response.statusCode} - $body');
        return 'Aura Engine error: ${response.statusCode}';
      }
    } catch (e) {
      print('Aura Engine request failed: $e');
      return 'Aura unavailable. $e';
    } finally {
      client.close();
    }
  }
}

/// Hybrid client that uses Hermes WebSocket first and HTTP as fallback.
class AuraTransport {
  final HermesBridgeService bridge;
  final AuraEngineService http;

  AuraTransport({
    HermesBridgeService? bridge,
    AuraEngineService? http,
  })  : bridge = bridge ?? HermesBridgeService(),
        http = http ?? AuraEngineService();

  Future<String> sendChat(String query, {String mode = 'personal'}) async {
    final connected = bridge.isConnected || await bridge.connect();
    if (connected) {
      try {
        final wsResult = await _sendViaBridge(query, mode: mode);
        if (wsResult.isNotEmpty) return wsResult;
      } catch (_) {
        // Fall through to HTTP below.
      }
    }
    return http.sendChatRequest(query, mode: mode);
  }

  Future<String> _sendViaBridge(String query, {String mode = 'personal'}) async {
    final completer = Completer<String>();
    final buffer = StringBuffer();
    late StreamSubscription<WsBridgeMessage> subscription;

    subscription = bridge.messageStream.listen((message) {
      if (completer.isCompleted) return;
      if (message is WsTextMessage) {
        completer.complete(message.payload);
      } else if (message is WsBitmapMessage) {
        completer.complete(message.payload);
      } else if (message is WsChunkMessage) {
        buffer.write(message.text);
      } else if (message is WsDoneMessage) {
        completer.complete(
          message.text.isNotEmpty ? message.text : buffer.toString(),
        );
      } else if (message is WsErrorMessage) {
        completer.completeError(HermesBridgeException(message.message));
      } else if (message is WsHelloErrorMessage) {
        completer.completeError(HermesBridgeException(message.error));
      }
    });

    try {
      await bridge.sendChatQuery(query, mode: mode);
      return await completer.future.timeout(
        AuraConfig.transportBridgeTimeout,
        onTimeout: () {
          if (buffer.isNotEmpty) return buffer.toString();
          throw TimeoutException('Hermes bridge response timed out');
        },
      );
    } finally {
      await subscription.cancel();
    }
  }

  void dispose() {
    bridge.dispose();
  }
}

class HermesBridgeException implements Exception {
  final String message;

  const HermesBridgeException(this.message);

  @override
  String toString() => 'HermesBridgeException: $message';
}
