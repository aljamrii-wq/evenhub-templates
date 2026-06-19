import 'dart:async';
import 'package:aura_app/services/aura_engine_service.dart';

/// Arabic text rendering pipeline for G2 smart glasses.
///
/// Workflow: Arabic speech → Aura Engine translates → English → G2 display.
/// The G2 display does NOT support Arabic fonts or RTL layout.
class ArabicPipeline {
  static ArabicPipeline? _instance;
  static ArabicPipeline get get => _instance ??= ArabicPipeline._();

  ArabicPipeline._();

  final HermesBridgeService _bridge = HermesBridgeService();

  bool _isProcessing = false;
  bool get isProcessing => _isProcessing;

  final StreamController<String> _outputController =
      StreamController<String>.broadcast();
  Stream<String> get outputStream => _outputController.stream;

  Future<String> processArabic(String arabicText,
      {String mode = 'chat'}) async {
    if (arabicText.trim().isEmpty) {
      _outputController.add('(No speech recognized)');
      return '(No speech recognized)';
    }
    _isProcessing = true;
    late StreamSubscription<String> subscription;
    try {
      final query = _buildQuery(arabicText, mode);
      final buffer = StringBuffer();
      final completer = Completer<String>();

      // Subscribe BEFORE sending to avoid missing early chunks
      subscription = _bridge.textStream.listen(
        (chunk) => buffer.write(chunk),
        onError: (error) {
          if (!completer.isCompleted) {
            _isProcessing = false;
            final msg = 'Pipeline error: $error';
            _outputController.add(msg);
            completer.complete(msg);
          }
        },
      );

      // Send AFTER subscribing — bridge broadcast stream never closes,
      // so we rely on timeout to finish collection
      await _bridge.sendChatQuery(query, mode: mode);

      final result = await completer.future.timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          _isProcessing = false;
          final msg = buffer.isNotEmpty ? buffer.toString() : 'Pipeline timed out';
          _outputController.add(msg);
          return msg;
        },
      );
      return _formatForG2(result);
    } catch (e) {
      _isProcessing = false;
      final msg = 'Arabic pipeline error: $e';
      _outputController.add(msg);
      return msg;
    } finally {
      subscription.cancel();
    }
  }

  Future<String> processArabicSync(String arabicText,
      {String mode = 'chat'}) async {
    if (arabicText.trim().isEmpty) return '(No speech recognized)';
    _isProcessing = true;
    try {
      final engine = AuraEngineService();
      final answer =
          await engine.sendChatRequest(_buildQuery(arabicText, mode),
              mode: mode);
      _isProcessing = false;
      final result = _formatForG2(answer);
      _outputController.add(result);
      return result;
    } catch (e) {
      _isProcessing = false;
      final msg = 'Arabic pipeline error: $e';
      _outputController.add(msg);
      return msg;
    }
  }

  String _buildQuery(String arabicText, String mode) {
    switch (mode) {
      case 'flydubai':
        return 'Flydubai context: $arabicText';
      case 'aljamri':
        return 'Aljamri business context: $arabicText';
      default:
        return arabicText;
    }
  }

  String _formatForG2(String text) {
    final cleaned = text.replaceAll(RegExp(r'[^\x00-\x7F\s]'), '');
    if (cleaned.length > 500) {
      return '${cleaned.substring(0, 497)}...';
    }
    return cleaned;
  }

  Future<bool> connect() => _bridge.connect();

  void dispose() {
    _bridge.dispose();
    _outputController.close();
  }
}

class ArabicPipelineUtil {
  static Future<String> quickProcess(String arabicText,
      {String mode = 'chat'}) async {
    return ArabicPipeline.get.processArabicSync(arabicText, mode: mode);
  }
}
