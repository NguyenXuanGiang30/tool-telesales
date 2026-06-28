import 'package:flutter_test/flutter_test.dart';
import 'package:boxphone_agent/main.dart';

void main() {
  testWidgets('Agent Shell App rendering smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const MyApp());

    // Verify that our app bar text is rendered.
    expect(find.text('Boxphone Android Agent Shell'), findsWidgets);

    // Verify that sections are rendered correctly.
    expect(find.text('Gateway Connection Settings'), findsOneWidget);
    expect(find.text('Device Token'), findsOneWidget);
    expect(find.text('Telephony Simulator Boundary'), findsOneWidget);
    expect(find.text('Device Hardware Health Simulator'), findsOneWidget);
  });
}
