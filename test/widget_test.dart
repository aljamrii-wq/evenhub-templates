import 'package:flutter_test/flutter_test.dart';
import 'package:aura_app/main.dart';
import 'package:flutter/material.dart';

void main() {
  group('Aura App', () {
    testWidgets('renders with Aura title', (WidgetTester tester) async {
      await tester.pumpWidget(const MyApp());
      expect(find.text('Aura'), findsWidgets);
    });

    testWidgets('uses dark theme', (WidgetTester tester) async {
      await tester.pumpWidget(const MyApp());
      final materialApp = tester.widget<MaterialApp>(find.byType(MaterialApp));
      expect(materialApp.theme?.brightness, equals(Brightness.dark));
    });

    testWidgets('debug banner is disabled', (WidgetTester tester) async {
      await tester.pumpWidget(const MyApp());
      final materialApp = tester.widget<MaterialApp>(find.byType(MaterialApp));
      expect(materialApp.debugShowCheckedModeBanner, isFalse);
    });

    testWidgets('uses Material 3', (WidgetTester tester) async {
      await tester.pumpWidget(const MyApp());
      final materialApp = tester.widget<MaterialApp>(find.byType(MaterialApp));
      expect(materialApp.theme?.useMaterial3, isTrue);
    });

    testWidgets('home page is rendered', (WidgetTester tester) async {
      await tester.pumpWidget(const MyApp());
      // HomePage should have a Scaffold with an AppBar titled 'Aura'
      expect(find.byType(AppBar), findsOneWidget);
    });
  });
}
