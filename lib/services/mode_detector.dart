import 'dart:async';
import 'package:flutter/services.dart';

/// Operating modes for the Aura glasses companion app.
enum AuraMode {
  flydubai,
  aljamri,
  personal,
}

class ModeDetector {
  static ModeDetector? _instance;
  static ModeDetector get get => _instance ??= ModeDetector._();

  ModeDetector._();

  static const _channel = MethodChannel('method.modedetector');

  AuraMode _currentMode = AuraMode.personal;
  AuraMode? _manualOverride;

  final StreamController<AuraMode> _modeController =
      StreamController<AuraMode>.broadcast();

  Stream<AuraMode> get modeStream => _modeController.stream;

  AuraMode get currentMode {
    if (_manualOverride != null) return _manualOverride!;
    return _detectAutoMode();
  }

  void setManualOverride(AuraMode? mode) {
    final previous = currentMode;
    _manualOverride = mode;
    final next = currentMode;
    if (previous != next) {
      _modeController.add(next);
    }
  }

  void setMode(AuraMode mode) {
    setManualOverride(mode);
  }

  AuraMode _detectAutoMode() {
    final now = DateTime.now();
    final hour = now.hour;
    final weekday = now.weekday;

    // UAE weekend: Friday(5) and Saturday(6)
    final isWeekend =
        weekday == DateTime.friday || weekday == DateTime.saturday;

    if (isWeekend) {
      return AuraMode.personal;
    }

    if (hour >= 9 && hour < 18) {
      return AuraMode.flydubai;
    }

    if (hour >= 18 && hour < 22) {
      return AuraMode.aljamri;
    }

    return AuraMode.personal;
  }

  String get currentModeLabel {
    switch (currentMode) {
      case AuraMode.flydubai:
        return 'Flydubai';
      case AuraMode.aljamri:
        return 'Aljamri';
      case AuraMode.personal:
        return 'Personal';
    }
  }

  String get currentModeIcon {
    switch (currentMode) {
      case AuraMode.flydubai:
        return '✈️';
      case AuraMode.aljamri:
        return '🏗️';
      case AuraMode.personal:
        return '🏠';
    }
  }

  void startListening() {
    _channel.setMethodCallHandler((call) async {
      switch (call.method) {
        case 'modeSwitch':
          final modeName = call.arguments as String?;
          if (modeName != null) {
            switch (modeName.toLowerCase()) {
              case 'flydubai':
                setManualOverride(AuraMode.flydubai);
                break;
              case 'aljamri':
                setManualOverride(AuraMode.aljamri);
                break;
              case 'personal':
                setManualOverride(AuraMode.personal);
                break;
            }
          }
          break;
        case 'clearOverride':
          setManualOverride(null);
          break;
      }
    });
  }

  void dispose() {
    _modeController.close();
  }
}
