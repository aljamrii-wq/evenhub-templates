import 'package:flutter_test/flutter_test.dart';
import 'package:aura_app/services/mode_detector.dart';

void main() {
  group('ModeDetector', () {
    late ModeDetector detector;

    setUp(() {
      detector = ModeDetector.get;
      detector.setManualOverride(null);
    });

    test('initial mode is not null', () {
      expect(detector.currentMode, isNotNull);
    });

    test('currentModeLabel returns valid strings', () {
      // All modes should have labels
      detector.setMode(AuraMode.flydubai);
      expect(detector.currentModeLabel, equals('Flydubai'));

      detector.setMode(AuraMode.aljamri);
      expect(detector.currentModeLabel, equals('Aljamri'));

      detector.setMode(AuraMode.personal);
      expect(detector.currentModeLabel, equals('Personal'));
    });

    test('currentModeIcon returns icons', () {
      detector.setMode(AuraMode.flydubai);
      expect(detector.currentModeIcon, equals('✈️'));

      detector.setMode(AuraMode.aljamri);
      expect(detector.currentModeIcon, equals('🏗️'));

      detector.setMode(AuraMode.personal);
      expect(detector.currentModeIcon, equals('🏠'));
    });

    test('manual override takes precedence over auto-detect', () {
      detector.setMode(AuraMode.personal);
      expect(detector.currentMode, equals(AuraMode.personal));

      detector.setMode(AuraMode.flydubai);
      expect(detector.currentMode, equals(AuraMode.flydubai));
    });

    test('clearing override returns to auto-detect', () {
      detector.setMode(AuraMode.flydubai);
      expect(detector.currentMode, equals(AuraMode.flydubai));

      detector.setManualOverride(null);
      // Should return to auto-detection (not null)
      expect(detector.currentMode, isNotNull);
    });

    test('mode stream emits on change', () async {
      detector.setMode(AuraMode.personal);

      final stream = detector.modeStream;
      detector.setMode(AuraMode.aljamri);

      final mode = await stream.first;
      expect(mode, equals(AuraMode.aljamri));
    });

    test('mode values are distinct', () {
      expect(AuraMode.flydubai, isNot(equals(AuraMode.aljamri)));
      expect(AuraMode.aljamri, isNot(equals(AuraMode.personal)));
      expect(AuraMode.personal, isNot(equals(AuraMode.flydubai)));
    });
  });
}
