import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:aura_app/services/config_service.dart';

/// Hermes Bridge WebSocket client for real-time Aura Engine communication.
///
/// Connects to the Hermes bridge running on the server (Tailscale IP)
/// and streams responses back to the glasses in real-time.
///
/// Protocol: JSON over WebSocket
///   → { "type": "chat", "query": "...", "mode": "..." }
///   ← { "type": "chunk", "text": "..." }
///   ← { "type": "done", "text": "full answer" }
///   ← { "type": "error", "message": "..." }
class HermesBridgeService {
  final String _wsUrl;
  WebSocket? _ws;
  bool _isConnected = false;

  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = AuraConfig.wsMaxReconnectAttempts;
  static const Duration _reconnectDelay = AuraConfig.wsReconnectDelay;
  Timer? _reconnectTimer;

  final StreamController<String> _textController =
      StreamController<String>.broadcast();

  Stream<String> get textStream => _textController.stream;
  bool get isConnected => _isConnected;

  HermesBridgeService({
    String? wsUrl,
  }) : _wsUrl = wsUrl ?? AuraConfig.hermesBridgeWsUrl;

  Future<bool> connect() async {
    if (_isConnected) return true;
    try {
      _ws = await WebSocket.connect(_wsUrl)
          .timeout(AuraConfig.wsConnectTimeout);
      _isConnected = true;
      _reconnectAttempts = 0;
      _ws!.listen(
        _onMessage,
        onError: _onError,
        onDone: _onDone,
        cancelOnError: false,
      );
      return true;
    } catch (e) {
      print('HermesBridge: connection failed — $e');
      _scheduleReconnect();
      return false;
    }
  }

  Future<void> sendChatQuery(String query, {String mode = 'chat'}) async {
    if (!_isConnected) {
      final connected = await connect();
      if (!connected) {
        _textController.add('Aura Engine: connection failed.');
        return;
      }
    }
    final message = jsonEncode({
      'type': 'chat',
      'query': query,
      'mode': mode,
    });
    try {
      _ws!.add(message);
    } catch (e) {
      print('HermesBridge: send failed — $e');
      _textController.add('Aura Engine: send error.');
      _handleDisconnect();
    }
  }

  Future<void> sendRaw(Map<String, dynamic> data) async {
    if (!_isConnected) {
      final connected = await connect();
      if (!connected) return;
    }
    try {
      _ws!.add(jsonEncode(data));
    } catch (e) {
      print('HermesBridge: raw send failed — $e');
      _handleDisconnect();
    }
  }

  void _onMessage(dynamic message) {
    try {
      final data = jsonDecode(message as String) as Map<String, dynamic>;
      final type = data['type'] as String?;
      switch (type) {
        case 'chunk':
          final text = data['text'] as String?;
          if (text != null) _textController.add(text);
          break;
        case 'done':
          final text = data['text'] as String?;
          if (text != null) _textController.add(text);
          break;
        case 'error':
          final msg = data['message'] as String? ?? 'Unknown error';
          _textController.add('Error: $msg');
          break;
      }
    } catch (e) {
      print('HermesBridge: failed to parse message — $e');
    }
  }

  void _onError(dynamic error) {
    print('HermesBridge: WebSocket error — $error');
    _handleDisconnect();
  }

  void _onDone() {
    print('HermesBridge: WebSocket closed');
    _handleDisconnect();
  }

  void _handleDisconnect() {
    _isConnected = false;
    _ws = null;
    _scheduleReconnect();
  }

  void _scheduleReconnect() {
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
    if (_ws != null) {
      await _ws!.close();
      _ws = null;
    }
    _isConnected = false;
    _reconnectAttempts = _maxReconnectAttempts;
  }

  void dispose() {
    _reconnectTimer?.cancel();
    _textController.close();
    _ws?.close();
    _ws = null;
    _isConnected = false;
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
        final data = jsonDecode(body);
        final answer = data['answer'] ?? data['text'] ?? body;
        return answer.toString();
      } else {
        print('Aura Engine error: ${response.statusCode} — $body');
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
