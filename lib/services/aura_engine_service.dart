import 'dart:convert';
import 'dart:io';

/// Client for the Aura Engine backend.
///
/// Replaces the Even/DeepSeek AI service with our own backend
/// running at Aura Engine (Tailscale: 100.76.131.27:8000).
class AuraEngineService {
  late final String _baseUrl;

  AuraEngineService({String? baseUrl}) {
    // Default to Aura Engine on Tailscale; falls back to external IP
    _baseUrl = baseUrl ?? 'http://100.76.131.27:8000';
  }

  /// Send a chat query to Aura Engine and get text response.
  /// Returns plain text suitable for rendering on glasses.
  Future<String> sendChatRequest(String question) async {
    final uri = Uri.parse('$_baseUrl/chat');
    final client = HttpClient();

    try {
      final request = await client.postUrl(uri);
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode({
        'query': question,
        'mode': 'chat',
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
