import 'package:flutter_test/flutter_test.dart';
import 'package:aura_app/services/evenai.dart';

void main() {
  group('EvenAI', () {
    group('singleton', () {
      test('get returns same instance', () {
        final a = EvenAI.get;
        final b = EvenAI.get;
        expect(identical(a, b), isTrue);
      });

      test('initial state is not running', () {
        expect(EvenAI.isRunning, isFalse);
      });

      test('initial state is not receiving audio', () {
        expect(EvenAI.get.isReceivingAudio, isFalse);
      });
    });

    group('transferToNewScreen', () {
      test('combines type and status flags', () {
        // type=0x01 (data), status=0x30 (new content)
        expect(EvenAIDataMethod.transferToNewScreen(0x01, 0x30), equals(0x31));
        // type=0x01, status=0x40 (final/screen save)
        expect(EvenAIDataMethod.transferToNewScreen(0x01, 0x40), equals(0x41));
        // type=0x01, status=0x50 (manual page)
        expect(EvenAIDataMethod.transferToNewScreen(0x01, 0x50), equals(0x51));
        // type=0x01, status=0x60 (error exit)
        expect(EvenAIDataMethod.transferToNewScreen(0x01, 0x60), equals(0x61));
      });
    });

    group('measureStringList', () {
      test('returns non-empty list for short text', () {
        final result = EvenAIDataMethod.measureStringList('Hello');
        expect(result, isNotEmpty);
      });

      test('splits long text into multiple lines', () {
        final longText = List.filled(500, 'A').join();
        final result = EvenAIDataMethod.measureStringList(longText);
        expect(result.length, greaterThan(1));
      });

      test('splits text on newlines', () {
        final result = EvenAIDataMethod.measureStringList('Line1\nLine2\nLine3');
        // Each line becomes a paragraph, then measured
        expect(result, isNotEmpty);
      });

      test('handles empty text', () {
        final result = EvenAIDataMethod.measureStringList('');
        expect(result, isEmpty);
      });

      test('trims whitespace from paragraphs', () {
        final result = EvenAIDataMethod.measureStringList('  Hello  \n  World  ');
        expect(result, isNotEmpty);
        for (final line in result) {
          expect(line.trim(), equals(line));
        }
      });
    });

    group('clear', () {
      test('resets state to defaults', () {
        EvenAI.get.clear();
        expect(EvenAI.isRunning, isFalse);
        expect(EvenAI.get.isReceivingAudio, isFalse);
      });
    });
  });
}
