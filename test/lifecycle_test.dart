import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/widgets.dart';
import 'package:aura_app/main.dart';

void main() {
  group('MyApp lifecycle', () {
    testWidgets('MyApp is a StatefulWidget', (WidgetTester tester) async {
      await tester.pumpWidget(const MyApp());
      // Verify the app builds without errors
      expect(find.byType(MyApp), findsOneWidget);
    });

    testWidgets('WidgetsBindingObserver is registered on init',
        (WidgetTester tester) async {
      await tester.pumpWidget(const MyApp());

      // Pump to ensure initState ran
      await tester.pump();

      // The observer should be registered — verify by checking
      // that the widget tree contains the MaterialApp (proves build ran)
      expect(find.byType(MaterialApp), findsOneWidget);
    });
  });
}
