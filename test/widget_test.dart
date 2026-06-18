import 'package:flutter_test/flutter_test.dart';
import 'package:aura_app/main.dart';

void main() {
  testWidgets('Aura app smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());
    expect(find.text('Aura'), findsWidgets);
  });
}
