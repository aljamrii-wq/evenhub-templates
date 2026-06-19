// ignore_for_file: library_private_types_in_public_api

import 'package:aura_app/views/features/bmp_page.dart';
import 'package:aura_app/localization/aura_app_strings.dart';
import 'package:aura_app/views/features/ehpk_webview_page.dart';
import 'package:aura_app/views/features/notification/notification_page.dart';
import 'package:aura_app/views/features/text_page.dart';
import 'package:flutter/material.dart';

class FeaturesPage extends StatefulWidget {
  const FeaturesPage({super.key});

  @override
  _FeaturesPageState createState() => _FeaturesPageState();
}

class _FeaturesPageState extends State<FeaturesPage> {
  @override
  Widget build(BuildContext context) {
    final strings = AuraAppStrings.of(Localizations.localeOf(context));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Features'),
      ),
      body: Padding(
        padding:
            const EdgeInsets.only(left: 16, right: 16, top: 12, bottom: 44),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.start,
          children: [
            _FeatureButton(
              label: "BMP",
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const BmpPage()),
                );
              },
            ),
            _FeatureButton(
              label: "Notification",
              margin: const EdgeInsets.only(top: 16),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (context) => const NotificationPage()),
                );
              },
            ),
            _FeatureButton(
              label: "Text",
              margin: const EdgeInsets.only(top: 16),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const TextPage()),
                );
              },
            ),
            _FeatureButton(
              label: strings.evenHubAppTitle,
              subtitle: strings.evenHubAppSubtitle,
              margin: const EdgeInsets.only(top: 16),
              textDirection: strings.textDirection,
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => EhpkWebViewPage(
                      launch: EhpkAppLaunch.sample(strings),
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _FeatureButton extends StatelessWidget {
  const _FeatureButton({
    required this.label,
    required this.onTap,
    this.subtitle,
    this.margin,
    this.textDirection = TextDirection.ltr,
  });

  final String label;
  final String? subtitle;
  final VoidCallback onTap;
  final EdgeInsetsGeometry? margin;
  final TextDirection textDirection;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          height: subtitle == null ? 60 : 72,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(5),
          ),
          alignment: Alignment.center,
          margin: margin,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Directionality(
            textDirection: textDirection,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(label, style: const TextStyle(fontSize: 16)),
                if (subtitle != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      subtitle!,
                      style: const TextStyle(fontSize: 12),
                      textAlign: TextAlign.center,
                    ),
                  ),
              ],
            ),
          ),
        ),
      );
}
