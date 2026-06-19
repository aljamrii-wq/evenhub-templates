import 'package:flutter/widgets.dart';

class AuraAppStrings {
  const AuraAppStrings._({
    required this.locale,
    required this.textDirection,
    required this.evenHubAppTitle,
    required this.evenHubAppSubtitle,
    required this.evenHubLoading,
    required this.evenHubReady,
    required this.evenHubBridgeReady,
    required this.evenHubBridgeError,
    required this.dismiss,
    required this.evenHubSampleHeading,
    required this.evenHubSampleBody,
  });

  final Locale locale;
  final TextDirection textDirection;
  final String evenHubAppTitle;
  final String evenHubAppSubtitle;
  final String evenHubLoading;
  final String evenHubReady;
  final String evenHubBridgeReady;
  final String evenHubBridgeError;
  final String dismiss;
  final String evenHubSampleHeading;
  final String evenHubSampleBody;

  static const supportedLocales = [
    Locale('en'),
    Locale('ar'),
  ];

  static AuraAppStrings of(Locale locale) {
    if (locale.languageCode.toLowerCase() == 'ar') {
      return ar;
    }
    return en;
  }

  static const en = AuraAppStrings._(
    locale: Locale('en'),
    textDirection: TextDirection.ltr,
    evenHubAppTitle: 'Even Hub App',
    evenHubAppSubtitle: '.ehpk WebView host',
    evenHubLoading: 'Loading Even Hub app...',
    evenHubReady: 'Even Hub app ready',
    evenHubBridgeReady: 'Bridge ready',
    evenHubBridgeError: 'Bridge error',
    dismiss: 'OK',
    evenHubSampleHeading: 'Aura WebView bridge',
    evenHubSampleBody: 'This sample page is running inside the Aura companion app.',
  );

  static const ar = AuraAppStrings._(
    locale: Locale('ar'),
    textDirection: TextDirection.rtl,
    evenHubAppTitle: 'تطبيق إيفن هب',
    evenHubAppSubtitle: 'مضيف WebView لحزمة .ehpk',
    evenHubLoading: 'جار تحميل تطبيق إيفن هب...',
    evenHubReady: 'تطبيق إيفن هب جاهز',
    evenHubBridgeReady: 'الجسر جاهز',
    evenHubBridgeError: 'خطأ في الجسر',
    dismiss: 'حسنا',
    evenHubSampleHeading: 'جسر Aura WebView',
    evenHubSampleBody: 'هذه صفحة تجريبية تعمل داخل تطبيق Aura المرافق.',
  );
}
