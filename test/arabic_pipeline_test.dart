import 'package:flutter_test/flutter_test.dart';
import 'package:aura_app/services/arabic_pipeline.dart';

void main() {
  group('ArabicPipeline', () {
    test('singleton returns same instance', () {
      final a = ArabicPipeline.get;
      final b = ArabicPipeline.get;
      expect(identical(a, b), isTrue);
    });

    test('initial state is not processing', () {
      expect(ArabicPipeline.get.isProcessing, isFalse);
    });

    test('empty text returns placeholder', () async {
      final result = await ArabicPipelineUtil.quickProcess('');
      expect(result, equals('(No speech recognized)'));
    });

    test('whitespace-only text returns placeholder', () async {
      final result = await ArabicPipelineUtil.quickProcess('   ');
      expect(result, equals('(No speech recognized)'));
    });

    test('processArabicSync calls AuraEngineService for non-empty text',
        () async {
      // processArabicSync sends real HTTP request — will fail in test
      // because Aura Engine is not available. Verify it returns an
      // error message rather than crashing.
      final result = await ArabicPipelineUtil.quickProcess('مرحبا');
      // Should return either an error message or a response
      expect(result, isNotEmpty);
      // Should NOT be the empty-text placeholder
      expect(result, isNot(equals('(No speech recognized)')));
    });
  });

  group('ArabicPipelineUtil', () {
    test('quickProcess exists and is callable', () {
      expect(ArabicPipelineUtil.quickProcess, isA<Function>());
    });
  });
}
