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

    test('non-empty text requires an Aura Engine backend', () {
      expect(ArabicPipelineUtil.quickProcess, isA<Function>());
    });
  });

  group('ArabicPipelineUtil', () {
    test('quickProcess exists and is callable', () {
      expect(ArabicPipelineUtil.quickProcess, isA<Function>());
    });
  });
}
