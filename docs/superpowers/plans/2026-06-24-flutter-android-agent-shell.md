# Flutter Android Agent Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Flutter Android Agent shell that can register with Gateway, heartbeat, report health, poll commands, ACK/NACK them, and expose a native foreground-service boundary.

**Architecture:** Build `android_agent/` as a standalone Flutter app with a small domain layer: config store, Gateway HTTP client, agent controller, command handler, and platform bridge. Keep real S9 telephony/audio behind interfaces so this package runs in simulator mode before hardware exists.

**Tech Stack:** Flutter/Dart, Material UI, Dart `http`, local persistence, Android Kotlin/Java platform channel, existing Gateway REST endpoints.

---

## Task 1: Flutter Project Shell

**Files:**

- Create: `android_agent/pubspec.yaml`
- Create: `android_agent/lib/main.dart`
- Create: `android_agent/lib/src/app.dart`
- Create: `android_agent/test/app_test.dart`

- [ ] **Step 1: Write the failing app smoke test**

Create `android_agent/test/app_test.dart`:

```dart
import 'package:boxphone_agent/src/app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders Boxphone Agent shell', (tester) async {
    await tester.pumpWidget(const BoxphoneAgentApp());

    expect(find.text('Boxphone Agent'), findsOneWidget);
    expect(find.text('Disconnected'), findsOneWidget);
    expect(find.byIcon(Icons.phone_android), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
Set-Location android_agent
flutter test test/app_test.dart
```

Expected: FAIL because `package:boxphone_agent/src/app.dart` does not exist yet.

- [ ] **Step 3: Create the minimal Flutter project shell**

Create `android_agent/pubspec.yaml`:

```yaml
name: boxphone_agent
description: Flutter Android Agent for Boxphone gateway command and audio control.
publish_to: none
version: 0.1.0+1

environment:
  sdk: ">=3.4.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
  http: ^1.2.2
  shared_preferences: ^2.3.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^5.0.0

flutter:
  uses-material-design: true
```

Create `android_agent/lib/main.dart`:

```dart
import 'package:boxphone_agent/src/app.dart';
import 'package:flutter/material.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const BoxphoneAgentApp());
}
```

Create `android_agent/lib/src/app.dart`:

```dart
import 'package:flutter/material.dart';

class BoxphoneAgentApp extends StatelessWidget {
  const BoxphoneAgentApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Boxphone Agent',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F766E)),
        useMaterial3: true,
      ),
      home: const Scaffold(
        body: SafeArea(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.phone_android),
                    SizedBox(width: 8),
                    Text('Boxphone Agent', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                  ],
                ),
                SizedBox(height: 12),
                Text('Disconnected'),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Run the smoke test and analyzer**

Run:

```powershell
Set-Location android_agent
flutter test test/app_test.dart
flutter analyze
```

Expected: PASS when Flutter SDK is installed.

- [ ] **Step 5: Commit**

Run:

```powershell
git add android_agent
git commit -m "feat: add Flutter Android Agent shell"
```

Expected: commit succeeds.

## Task 2: Agent Config and Local Store

**Files:**

- Create: `android_agent/lib/src/config/agent_config.dart`
- Create: `android_agent/lib/src/config/agent_store.dart`
- Test: `android_agent/test/agent_config_test.dart`

- [ ] **Step 1: Write failing config and store tests**

Create `android_agent/test/agent_config_test.dart`:

```dart
import 'package:boxphone_agent/src/config/agent_config.dart';
import 'package:boxphone_agent/src/config/agent_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('AgentConfig serializes and validates required fields', () {
    final config = AgentConfig(
      gatewayBaseUrl: 'http://127.0.0.1:8000/api/v1/gateway',
      deviceId: 's9-001',
      deviceToken: 'token-001',
      audioPort: 46001,
    );

    expect(config.validate(), isEmpty);
    expect(AgentConfig.fromJson(config.toJson()), equals(config));
  });

  test('AgentConfig reports invalid ports and intervals', () {
    final config = AgentConfig(
      gatewayBaseUrl: '',
      deviceId: '',
      deviceToken: '',
      audioPort: 70000,
      heartbeatIntervalSeconds: 0,
      pollIntervalSeconds: -1,
    );

    expect(config.validate(), contains('gatewayBaseUrl is required'));
    expect(config.validate(), contains('deviceId is required'));
    expect(config.validate(), contains('audioPort must be between 1 and 65535'));
    expect(config.validate(), contains('heartbeatIntervalSeconds must be positive'));
    expect(config.validate(), contains('pollIntervalSeconds must be positive'));
  });

  test('MemoryAgentStore saves and loads config', () async {
    final store = MemoryAgentStore();
    final config = AgentConfig(
      gatewayBaseUrl: 'http://gateway.local/api/v1/gateway',
      deviceId: 's9-002',
      deviceToken: 'secret',
      audioPort: 46002,
    );

    await store.save(config);

    expect(await store.load(), equals(config));
  });

  test('SharedPreferencesAgentStore persists config', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final store = SharedPreferencesAgentStore(prefs);
    final config = AgentConfig(
      gatewayBaseUrl: 'http://gateway.local/api/v1/gateway',
      deviceId: 's9-003',
      deviceToken: 'secret',
      audioPort: 46003,
    );

    await store.save(config);

    expect(await store.load(), equals(config));
  });
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
Set-Location android_agent
flutter test test/agent_config_test.dart
```

Expected: FAIL because config and store classes do not exist.

- [ ] **Step 3: Implement `AgentConfig`**

Create `android_agent/lib/src/config/agent_config.dart`:

```dart
class AgentConfig {
  const AgentConfig({
    required this.gatewayBaseUrl,
    required this.deviceId,
    required this.deviceToken,
    required this.audioPort,
    this.heartbeatIntervalSeconds = 10,
    this.pollIntervalSeconds = 1,
  });

  final String gatewayBaseUrl;
  final String deviceId;
  final String deviceToken;
  final int audioPort;
  final int heartbeatIntervalSeconds;
  final int pollIntervalSeconds;

  List<String> validate() {
    final errors = <String>[];
    if (gatewayBaseUrl.trim().isEmpty) errors.add('gatewayBaseUrl is required');
    if (deviceId.trim().isEmpty) errors.add('deviceId is required');
    if (audioPort < 1 || audioPort > 65535) errors.add('audioPort must be between 1 and 65535');
    if (heartbeatIntervalSeconds <= 0) errors.add('heartbeatIntervalSeconds must be positive');
    if (pollIntervalSeconds <= 0) errors.add('pollIntervalSeconds must be positive');
    return errors;
  }

  Map<String, Object?> toJson() => {
        'gatewayBaseUrl': gatewayBaseUrl,
        'deviceId': deviceId,
        'deviceToken': deviceToken,
        'audioPort': audioPort,
        'heartbeatIntervalSeconds': heartbeatIntervalSeconds,
        'pollIntervalSeconds': pollIntervalSeconds,
      };

  factory AgentConfig.fromJson(Map<String, Object?> json) {
    return AgentConfig(
      gatewayBaseUrl: json['gatewayBaseUrl'] as String? ?? '',
      deviceId: json['deviceId'] as String? ?? '',
      deviceToken: json['deviceToken'] as String? ?? '',
      audioPort: json['audioPort'] as int? ?? 46001,
      heartbeatIntervalSeconds: json['heartbeatIntervalSeconds'] as int? ?? 10,
      pollIntervalSeconds: json['pollIntervalSeconds'] as int? ?? 1,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AgentConfig &&
          gatewayBaseUrl == other.gatewayBaseUrl &&
          deviceId == other.deviceId &&
          deviceToken == other.deviceToken &&
          audioPort == other.audioPort &&
          heartbeatIntervalSeconds == other.heartbeatIntervalSeconds &&
          pollIntervalSeconds == other.pollIntervalSeconds;

  @override
  int get hashCode => Object.hash(
        gatewayBaseUrl,
        deviceId,
        deviceToken,
        audioPort,
        heartbeatIntervalSeconds,
        pollIntervalSeconds,
      );
}
```

- [ ] **Step 4: Implement memory and persisted stores**

Create `android_agent/lib/src/config/agent_store.dart`:

```dart
import 'dart:convert';

import 'package:boxphone_agent/src/config/agent_config.dart';
import 'package:shared_preferences/shared_preferences.dart';

abstract class AgentStore {
  Future<AgentConfig?> load();
  Future<void> save(AgentConfig config);
  Future<void> clear();
}

class MemoryAgentStore implements AgentStore {
  AgentConfig? _config;

  @override
  Future<AgentConfig?> load() async => _config;

  @override
  Future<void> save(AgentConfig config) async {
    _config = config;
  }

  @override
  Future<void> clear() async {
    _config = null;
  }
}

class SharedPreferencesAgentStore implements AgentStore {
  SharedPreferencesAgentStore(this._prefs);

  static const _key = 'boxphone.agent.config';
  final SharedPreferences _prefs;

  @override
  Future<AgentConfig?> load() async {
    final raw = _prefs.getString(_key);
    if (raw == null) return null;
    final decoded = jsonDecode(raw) as Map<String, dynamic>;
    return AgentConfig.fromJson(decoded);
  }

  @override
  Future<void> save(AgentConfig config) async {
    await _prefs.setString(_key, jsonEncode(config.toJson()));
  }

  @override
  Future<void> clear() async {
    await _prefs.remove(_key);
  }
}
```

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
Set-Location android_agent
flutter test test/agent_config_test.dart
flutter analyze
```

Expected: PASS.

Run:

```powershell
git add android_agent/lib/src/config android_agent/test/agent_config_test.dart
git commit -m "feat: add Android Agent config store"
```

Expected: commit succeeds.

## Task 3: Gateway Client

**Files:**

- Create: `android_agent/lib/src/gateway/gateway_client.dart`
- Create: `android_agent/lib/src/gateway/gateway_models.dart`
- Test: `android_agent/test/gateway_client_test.dart`

- [ ] **Step 1: Write failing Gateway client tests**

Create `android_agent/test/gateway_client_test.dart`:

```dart
import 'dart:convert';

import 'package:boxphone_agent/src/config/agent_config.dart';
import 'package:boxphone_agent/src/gateway/gateway_client.dart';
import 'package:boxphone_agent/src/gateway/gateway_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late List<String> requests;
  late GatewayClient client;
  final config = AgentConfig(
    gatewayBaseUrl: 'http://127.0.0.1:8000/api/v1/gateway',
    deviceId: 's9-001',
    deviceToken: 'token',
    audioPort: 46001,
  );

  setUp(() {
    requests = [];
    client = GatewayClient(
      transport: (method, uri, {headers, body}) async {
        requests.add('$method ${uri.path}');
        return GatewayHttpResponse(
          statusCode: 200,
          body: jsonEncode({
            'device_id': 's9-001',
            'status': 'idle',
            'command_id': 'cmd-001',
            'command': 'DIAL',
            'payload': {'phone_number': '+84901234567'}
          }),
        );
      },
    );
  });

  test('register posts device identity', () async {
    final device = await client.register(config);

    expect(requests.single, 'POST /api/v1/gateway/devices/register');
    expect(device.deviceId, 's9-001');
  });

  test('polls next command', () async {
    final command = await client.nextCommand(config);

    expect(requests.single, 'GET /api/v1/gateway/devices/s9-001/commands/next');
    expect(command?.commandId, 'cmd-001');
    expect(command?.name, GatewayCommandName.dial);
  });

  test('4xx errors are not retryable', () async {
    final failing = GatewayClient(
      transport: (method, uri, {headers, body}) async => const GatewayHttpResponse(statusCode: 401, body: 'unauthorized'),
    );

    expect(
      () => failing.heartbeat(config),
      throwsA(isA<GatewayClientException>().having((error) => error.retryable, 'retryable', false)),
    );
  });
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
Set-Location android_agent
flutter test test/gateway_client_test.dart
```

Expected: FAIL because `gateway_client.dart` and `gateway_models.dart` do not exist.

- [ ] **Step 3: Implement models**

Create `android_agent/lib/src/gateway/gateway_models.dart` with these public contracts:

```dart
enum GatewayCommandName { dial, hangup, ping, startAudio, stopAudio, unknown }

class GatewayDevice {
  const GatewayDevice({required this.deviceId, required this.status});

  final String deviceId;
  final String status;

  factory GatewayDevice.fromJson(Map<String, dynamic> json) {
    return GatewayDevice(
      deviceId: json['device_id'] as String,
      status: json['status'] as String? ?? 'unknown',
    );
  }
}

class GatewayCommand {
  const GatewayCommand({required this.commandId, required this.name, required this.payload});

  final String commandId;
  final GatewayCommandName name;
  final Map<String, dynamic> payload;

  factory GatewayCommand.fromJson(Map<String, dynamic> json) {
    final rawName = (json['command'] as String? ?? '').toUpperCase();
    final mappedName = switch (rawName) {
      'DIAL' => GatewayCommandName.dial,
      'HANGUP' => GatewayCommandName.hangup,
      'PING' => GatewayCommandName.ping,
      'START_AUDIO' => GatewayCommandName.startAudio,
      'STOP_AUDIO' => GatewayCommandName.stopAudio,
      _ => GatewayCommandName.unknown,
    };
    return GatewayCommand(
      commandId: json['command_id'] as String,
      name: mappedName,
      payload: Map<String, dynamic>.from(json['payload'] as Map? ?? const {}),
    );
  }
}

class DeviceHealthPayload {
  const DeviceHealthPayload({
    this.batteryPercent,
    this.temperatureC,
    this.signalDbm,
    this.charging,
    this.networkType,
  });

  final int? batteryPercent;
  final double? temperatureC;
  final int? signalDbm;
  final bool? charging;
  final String? networkType;

  Map<String, Object?> toJson() => {
        'battery_percent': batteryPercent,
        'temperature_c': temperatureC,
        'signal_dbm': signalDbm,
        'charging': charging,
        'network_type': networkType,
      };
}
```

- [ ] **Step 4: Implement the Gateway client**

Create `android_agent/lib/src/gateway/gateway_client.dart` with:

```dart
import 'dart:convert';

import 'package:boxphone_agent/src/config/agent_config.dart';
import 'package:boxphone_agent/src/gateway/gateway_models.dart';
import 'package:http/http.dart' as http;

typedef GatewayTransport = Future<GatewayHttpResponse> Function(
  String method,
  Uri uri, {
  Map<String, String>? headers,
  Object? body,
});

class GatewayHttpResponse {
  const GatewayHttpResponse({required this.statusCode, required this.body});
  final int statusCode;
  final String body;
}

class GatewayClientException implements Exception {
  GatewayClientException(this.message, {required this.retryable});
  final String message;
  final bool retryable;
}

class GatewayClient {
  GatewayClient({GatewayTransport? transport}) : _transport = transport ?? _defaultTransport;

  final GatewayTransport _transport;

  Future<GatewayDevice> register(AgentConfig config) async {
    final body = {
      'device_id': config.deviceId,
      'ip_address': 'android-agent',
      'app_version': '0.1.0',
      'audio_port': config.audioPort,
    };
    final json = await _request(config, 'POST', '/devices/register', body: body);
    return GatewayDevice.fromJson(json);
  }

  Future<GatewayDevice> heartbeat(AgentConfig config) async {
    final json = await _request(config, 'POST', '/devices/${Uri.encodeComponent(config.deviceId)}/heartbeat');
    return GatewayDevice.fromJson(json);
  }

  Future<GatewayDevice> sendHealth(AgentConfig config, DeviceHealthPayload health) async {
    final json = await _request(config, 'POST', '/devices/${Uri.encodeComponent(config.deviceId)}/health', body: health.toJson());
    return GatewayDevice.fromJson(json);
  }

  Future<GatewayCommand?> nextCommand(AgentConfig config) async {
    final json = await _request(config, 'GET', '/devices/${Uri.encodeComponent(config.deviceId)}/commands/next');
    if (json.isEmpty) return null;
    return GatewayCommand.fromJson(json);
  }

  Future<void> ackCommand(AgentConfig config, String commandId) async {
    await _request(config, 'POST', '/devices/${Uri.encodeComponent(config.deviceId)}/commands/$commandId/ack');
  }

  Future<void> nackCommand(AgentConfig config, String commandId, String error) async {
    await _request(
      config,
      'POST',
      '/devices/${Uri.encodeComponent(config.deviceId)}/commands/$commandId/nack',
      body: {'error': error},
    );
  }

  Future<Map<String, dynamic>> _request(AgentConfig config, String method, String path, {Object? body}) async {
    final base = Uri.parse(config.gatewayBaseUrl);
    final uri = base.replace(path: '${base.path}$path');
    final response = await _transport(
      method,
      uri,
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.deviceToken}'},
      body: body == null ? null : jsonEncode(body),
    );
    if (response.statusCode >= 400) {
      throw GatewayClientException('Gateway ${response.statusCode}: ${response.body}', retryable: response.statusCode >= 500);
    }
    if (response.body.trim().isEmpty) return {};
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  static Future<GatewayHttpResponse> _defaultTransport(String method, Uri uri, {Map<String, String>? headers, Object? body}) async {
    final request = http.Request(method, uri);
    request.headers.addAll(headers ?? const {});
    if (body is String) request.body = body;
    final streamed = await request.send();
    final bodyText = await streamed.stream.bytesToString();
    return GatewayHttpResponse(statusCode: streamed.statusCode, body: bodyText);
  }
}
```

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
Set-Location android_agent
flutter test test/gateway_client_test.dart
flutter analyze
```

Expected: PASS.

Run:

```powershell
git add android_agent/lib/src/gateway android_agent/test/gateway_client_test.dart
git commit -m "feat: add Android Agent gateway client"
```

Expected: commit succeeds.

## Task 4: Agent Controller and Command Handler

**Files:**

- Create: `android_agent/lib/src/agent/agent_controller.dart`
- Create: `android_agent/lib/src/agent/agent_state.dart`
- Create: `android_agent/lib/src/agent/command_handler.dart`
- Test: `android_agent/test/agent_controller_test.dart`

- [ ] **Step 1: Write failing controller tests**

Create `android_agent/test/agent_controller_test.dart`:

```dart
import 'package:boxphone_agent/src/agent/agent_controller.dart';
import 'package:boxphone_agent/src/agent/command_handler.dart';
import 'package:boxphone_agent/src/config/agent_config.dart';
import 'package:boxphone_agent/src/gateway/gateway_client.dart';
import 'package:boxphone_agent/src/gateway/gateway_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final config = AgentConfig(
    gatewayBaseUrl: 'http://127.0.0.1:8000/api/v1/gateway',
    deviceId: 's9-001',
    deviceToken: 'token',
    audioPort: 46001,
  );

  test('CommandHandler ACKs DIAL and stores active call', () async {
    final handler = CommandHandler();
    final result = await handler.handle(
      const GatewayCommand(
        commandId: 'cmd-001',
        name: GatewayCommandName.dial,
        payload: {'call_id': 'call-001', 'phone_number': '+84901234567'},
      ),
    );

    expect(result.ack, true);
    expect(handler.activeCallId, 'call-001');
  });

  test('CommandHandler NACKs unsupported commands', () async {
    final handler = CommandHandler();
    final result = await handler.handle(
      const GatewayCommand(commandId: 'cmd-002', name: GatewayCommandName.unknown, payload: {}),
    );

    expect(result.ack, false);
    expect(result.error, 'unsupported_command');
  });

  test('AgentController polls command and ACKs successful execution', () async {
    final fake = FakeGatewayClient(GatewayCommand(
      commandId: 'cmd-003',
      name: GatewayCommandName.ping,
      payload: const {},
    ));
    final controller = AgentController(config: config, gatewayClient: fake, commandHandler: CommandHandler());

    await controller.pollOnce();

    expect(fake.ackedCommandIds, ['cmd-003']);
    expect(controller.state.lastCommandId, 'cmd-003');
    expect(controller.state.lastError, isNull);
  });
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
Set-Location android_agent
flutter test test/agent_controller_test.dart
```

Expected: FAIL because agent controller classes do not exist.

- [ ] **Step 3: Implement agent state and command handling**

Create `android_agent/lib/src/agent/agent_state.dart`:

```dart
enum AgentConnectionStatus { disconnected, registered, running, error }

class AgentState {
  const AgentState({
    this.status = AgentConnectionStatus.disconnected,
    this.activeCallId,
    this.lastHeartbeat,
    this.lastCommandId,
    this.lastError,
    this.logs = const [],
  });

  final AgentConnectionStatus status;
  final String? activeCallId;
  final DateTime? lastHeartbeat;
  final String? lastCommandId;
  final String? lastError;
  final List<String> logs;
}
```

Create `android_agent/lib/src/agent/command_handler.dart`:

```dart
import 'package:boxphone_agent/src/gateway/gateway_models.dart';

class CommandResult {
  const CommandResult.ack() : ack = true, error = null;
  const CommandResult.nack(this.error) : ack = false;

  final bool ack;
  final String? error;
}

class CommandHandler {
  String? activeCallId;

  Future<CommandResult> handle(GatewayCommand command) async {
    switch (command.name) {
      case GatewayCommandName.ping:
      case GatewayCommandName.startAudio:
      case GatewayCommandName.stopAudio:
        return const CommandResult.ack();
      case GatewayCommandName.dial:
        activeCallId = command.payload['call_id'] as String?;
        return const CommandResult.ack();
      case GatewayCommandName.hangup:
        activeCallId = null;
        return const CommandResult.ack();
      case GatewayCommandName.unknown:
        return const CommandResult.nack('unsupported_command');
    }
  }
}
```

- [ ] **Step 4: Implement controller one-shot methods and loops**

Create `android_agent/lib/src/agent/agent_controller.dart`:

```dart
import 'dart:async';

import 'package:boxphone_agent/src/agent/agent_state.dart';
import 'package:boxphone_agent/src/agent/command_handler.dart';
import 'package:boxphone_agent/src/config/agent_config.dart';
import 'package:boxphone_agent/src/gateway/gateway_client.dart';

class AgentController {
  AgentController({required this.config, required this.gatewayClient, required this.commandHandler});

  final AgentConfig config;
  final GatewayClient gatewayClient;
  final CommandHandler commandHandler;
  AgentState state = const AgentState();
  Timer? _heartbeatTimer;
  Timer? _pollTimer;

  Future<void> registerOnce() async {
    await gatewayClient.register(config);
    state = AgentState(status: AgentConnectionStatus.registered, logs: state.logs.followedBy(['registered']).toList());
  }

  Future<void> heartbeatOnce() async {
    await gatewayClient.heartbeat(config);
    state = AgentState(
      status: state.status,
      activeCallId: commandHandler.activeCallId,
      lastHeartbeat: DateTime.now(),
      lastCommandId: state.lastCommandId,
      logs: state.logs.followedBy(['heartbeat']).toList(),
    );
  }

  Future<void> pollOnce() async {
    final command = await gatewayClient.nextCommand(config);
    if (command == null) return;
    final result = await commandHandler.handle(command);
    if (result.ack) {
      await gatewayClient.ackCommand(config, command.commandId);
    } else {
      await gatewayClient.nackCommand(config, command.commandId, result.error ?? 'command_failed');
    }
    state = AgentState(
      status: AgentConnectionStatus.running,
      activeCallId: commandHandler.activeCallId,
      lastHeartbeat: state.lastHeartbeat,
      lastCommandId: command.commandId,
      lastError: result.ack ? null : result.error,
      logs: state.logs.followedBy(['${result.ack ? 'ack' : 'nack'} ${command.commandId}']).toList(),
    );
  }

  void startLoops() {
    _heartbeatTimer?.cancel();
    _pollTimer?.cancel();
    _heartbeatTimer = Timer.periodic(Duration(seconds: config.heartbeatIntervalSeconds), (_) => heartbeatOnce());
    _pollTimer = Timer.periodic(Duration(seconds: config.pollIntervalSeconds), (_) => pollOnce());
    state = AgentState(status: AgentConnectionStatus.running, logs: state.logs.followedBy(['loops_started']).toList());
  }

  void stopLoops() {
    _heartbeatTimer?.cancel();
    _pollTimer?.cancel();
    state = AgentState(status: AgentConnectionStatus.disconnected, logs: state.logs.followedBy(['loops_stopped']).toList());
  }
}
```

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
Set-Location android_agent
flutter test test/agent_controller_test.dart
flutter analyze
```

Expected: PASS.

Run:

```powershell
git add android_agent/lib/src/agent android_agent/test/agent_controller_test.dart
git commit -m "feat: add Android Agent controller"
```

Expected: commit succeeds.

## Task 5: UI for Config, Status, and Logs

**Files:**

- Modify: `android_agent/lib/src/app.dart`
- Create: `android_agent/lib/src/ui/agent_home_page.dart`
- Create: `android_agent/lib/src/ui/status_badge.dart`
- Test: `android_agent/test/agent_home_page_test.dart`

- [ ] **Step 1: Write failing UI tests**

Create `android_agent/test/agent_home_page_test.dart`:

```dart
import 'package:boxphone_agent/src/app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('home page saves config fields and shows validation', (tester) async {
    await tester.pumpWidget(const BoxphoneAgentApp());

    await tester.tap(find.text('Save'));
    await tester.pump();

    expect(find.text('gatewayBaseUrl is required'), findsOneWidget);
    expect(find.text('deviceId is required'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('gatewayBaseUrlField')), 'http://127.0.0.1:8000/api/v1/gateway');
    await tester.enterText(find.byKey(const Key('deviceIdField')), 's9-001');
    await tester.enterText(find.byKey(const Key('deviceTokenField')), 'token');
    await tester.enterText(find.byKey(const Key('audioPortField')), '46001');
    await tester.tap(find.text('Save'));
    await tester.pump();

    expect(find.text('Config saved'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
Set-Location android_agent
flutter test test/agent_home_page_test.dart
```

Expected: FAIL because the home page form and keys do not exist.

- [ ] **Step 3: Build compact operations UI**

Create `android_agent/lib/src/ui/status_badge.dart`:

```dart
import 'package:flutter/material.dart';

class StatusBadge extends StatelessWidget {
  const StatusBadge({required this.label, required this.color, super.key});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text(label),
      avatar: Icon(Icons.circle, color: color, size: 10),
    );
  }
}
```

Create `android_agent/lib/src/ui/agent_home_page.dart` with these fields and controls:

```dart
// Required visible controls:
// Key('gatewayBaseUrlField') TextFormField
// Key('deviceIdField') TextFormField
// Key('deviceTokenField') TextFormField
// Key('audioPortField') TextFormField
// Save button
// Register button
// Start button
// Stop button
// Status summary text
// Log list
```

The form must create `AgentConfig`, call `validate()`, show validation messages inline, and never hardcode a production Gateway URL.

- [ ] **Step 4: Wire `BoxphoneAgentApp` to the home page**

Modify `android_agent/lib/src/app.dart` so `home:` is `const AgentHomePage()` and the app still renders `Boxphone Agent`.

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
Set-Location android_agent
flutter test test/agent_home_page_test.dart
flutter analyze
```

Expected: PASS.

Run:

```powershell
git add android_agent/lib/src/app.dart android_agent/lib/src/ui android_agent/test/agent_home_page_test.dart
git commit -m "feat: add Android Agent operations UI"
```

Expected: commit succeeds.

## Task 6: Android Native Foreground Service Skeleton

**Files:**

- Modify: `android_agent/android/app/src/main/AndroidManifest.xml`
- Create or modify: `android_agent/android/app/src/main/kotlin/com/tooltelesales/boxphone_agent/MainActivity.kt`
- Create: `android_agent/android/app/src/main/kotlin/com/tooltelesales/boxphone_agent/AgentForegroundService.kt`
- Create: `android_agent/lib/src/native/platform_bridge.dart`
- Test: `android_agent/test/platform_bridge_test.dart`

- [ ] **Step 1: Write failing platform bridge test**

Create `android_agent/test/platform_bridge_test.dart`:

```dart
import 'package:boxphone_agent/src/native/platform_bridge.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('PlatformBridge calls foreground service channel', () async {
    final calls = <MethodCall>[];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      PlatformBridge.channel,
      (call) async {
        calls.add(call);
        if (call.method == 'getNativeStatus') return {'foreground': true};
        return null;
      },
    );

    final bridge = PlatformBridge();
    await bridge.startForegroundService();
    final status = await bridge.getNativeStatus();

    expect(calls.map((call) => call.method), containsAll(['startForegroundService', 'getNativeStatus']));
    expect(status['foreground'], true);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
Set-Location android_agent
flutter test test/platform_bridge_test.dart
```

Expected: FAIL because `PlatformBridge` does not exist.

- [ ] **Step 3: Implement Dart platform bridge**

Create `android_agent/lib/src/native/platform_bridge.dart`:

```dart
import 'package:flutter/services.dart';

class PlatformBridge {
  static const channel = MethodChannel('boxphone_agent/native');

  Future<void> startForegroundService() => channel.invokeMethod<void>('startForegroundService');
  Future<void> stopForegroundService() => channel.invokeMethod<void>('stopForegroundService');

  Future<Map<String, Object?>> getNativeStatus() async {
    final raw = await channel.invokeMapMethod<String, Object?>('getNativeStatus');
    return raw ?? const {'foreground': false};
  }
}
```

- [ ] **Step 4: Add Android service skeleton**

Add these manifest permissions and service entry to `android_agent/android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />

<service
    android:name=".AgentForegroundService"
    android:exported="false"
    android:foregroundServiceType="phoneCall" />
```

Create `android_agent/android/app/src/main/kotlin/com/tooltelesales/boxphone_agent/AgentForegroundService.kt`:

```kotlin
package com.tooltelesales.boxphone_agent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.IBinder

class AgentForegroundService : Service() {
    override fun onCreate() {
        super.onCreate()
        val channel = NotificationChannel("boxphone_agent", "Boxphone Agent", NotificationManager.IMPORTANCE_LOW)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        val notification = Notification.Builder(this, "boxphone_agent")
            .setContentTitle("Boxphone Agent")
            .setContentText("Gateway command service is running")
            .setSmallIcon(android.R.drawable.sym_call_outgoing)
            .build()
        startForeground(1001, notification)
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
```

Update `MainActivity.kt` to handle `startForegroundService`, `stopForegroundService`, and `getNativeStatus` on channel `boxphone_agent/native`.

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
Set-Location android_agent
flutter test test/platform_bridge_test.dart
flutter analyze
```

Expected: PASS.

Run:

```powershell
git add android_agent/android android_agent/lib/src/native android_agent/test/platform_bridge_test.dart
git commit -m "feat: add Android Agent foreground service skeleton"
```

Expected: commit succeeds.

## Task 7: Package Verification

- [ ] **Step 1: Run all Flutter checks**

Run:

```powershell
Set-Location android_agent
flutter test
flutter analyze
```

Expected: all Flutter tests PASS and analyzer exits 0.

- [ ] **Step 2: Run Gateway regression tests from repo root**

Run:

```powershell
Set-Location D:\tool_telesales
D:\tool_telesales\.python312\python.exe -m pytest backend\tests\gateway -v
```

Expected: Gateway tests PASS.

- [ ] **Step 3: Verify no accidental generated files were staged**

Run:

```powershell
git status --short --branch
```

Expected: only intended Android Agent files are modified or the working tree is clean after commits.

---

## Detailed File Contracts

### `android_agent/lib/src/config/agent_config.dart`

Required public API:

```dart
class AgentConfig {
  const AgentConfig({
    required this.gatewayBaseUrl,
    required this.deviceId,
    required this.deviceToken,
    required this.audioPort,
    this.heartbeatIntervalSeconds = 5,
    this.pollIntervalSeconds = 2,
  });

  final String gatewayBaseUrl;
  final String deviceId;
  final String deviceToken;
  final int audioPort;
  final int heartbeatIntervalSeconds;
  final int pollIntervalSeconds;

  Map<String, Object?> toJson();
  factory AgentConfig.fromJson(Map<String, Object?> json);
  List<String> validate();
}
```

Validation rules:

- `gatewayBaseUrl` must parse as absolute HTTP/HTTPS URL.
- `deviceId` must not be blank.
- `deviceToken` must not be blank, even if backend token enforcement is added in a later package.
- `audioPort` must be 1-65535.
- `heartbeatIntervalSeconds` must be 1-300.
- `pollIntervalSeconds` must be 1-60.

### `android_agent/lib/src/gateway/gateway_models.dart`

Required models:

```dart
enum GatewayCommandAckStatus { acked, nacked }

class GatewayCommand {
  const GatewayCommand({
    required this.commandId,
    required this.command,
    required this.deviceId,
    this.callId,
    this.payload = const <String, Object?>{},
  });

  final String commandId;
  final String command;
  final String deviceId;
  final String? callId;
  final Map<String, Object?> payload;
}

class DeviceHealthSnapshot {
  const DeviceHealthSnapshot({
    this.batteryPercent,
    this.temperatureC,
    this.signalDbm,
    this.charging,
    this.networkType,
    this.storageFreeMb,
  });

  final int? batteryPercent;
  final double? temperatureC;
  final int? signalDbm;
  final bool? charging;
  final String? networkType;
  final int? storageFreeMb;
}
```

Command payload expectations:

- `DIAL`: `phone_number`, `sim_slot`, `audio_in_port`, `audio_out_port`.
- `HANGUP`: optional `reason`.
- `START_AUDIO`: `sample_rate`, `channels`, `codec`.
- `STOP_AUDIO`: optional `reason`.
- `PING`: no required payload.

### `android_agent/lib/src/gateway/gateway_client.dart`

Required behavior:

- All request bodies use JSON.
- `deviceToken` is sent as header `X-Device-Token`.
- `GatewayClientException.retryable == false` for HTTP 400, 401, 403, 404, 409, 422.
- `GatewayClientException.retryable == true` for HTTP 500+ and network exceptions.
- Timeout defaults to 5 seconds.

Endpoint mapping:

```text
register    -> POST {base}/api/v1/gateway/devices/register
heartbeat   -> POST {base}/api/v1/gateway/devices/{deviceId}/heartbeat
health      -> POST {base}/api/v1/gateway/devices/{deviceId}/health
nextCommand -> GET  {base}/api/v1/gateway/devices/{deviceId}/commands/next
ack/nack    -> POST {base}/api/v1/gateway/devices/{deviceId}/commands/{commandId}/ack
```

### `android_agent/lib/src/agent/agent_controller.dart`

Required state transitions:

- Initial: `stopped`.
- `registerOnce` success: `registered`.
- `startLoops`: `running`.
- `stopLoops`: `stopped`.
- Any non-retryable Gateway error: `error`.
- Retryable errors append log but loops continue.

Loop requirements:

- Heartbeat loop and command polling loop must be independently cancellable.
- `pollOnce` must never process two commands concurrently.
- Command ACK/NACK must be sent exactly once per command id.

### `android_agent/lib/src/agent/command_handler.dart`

Simulator-mode behavior:

```text
PING        -> ack
DIAL        -> activeCallId = call_id; ack
HANGUP      -> activeCallId = null; ack
START_AUDIO -> audioMode = simulated; ack
STOP_AUDIO  -> audioMode = stopped; ack
unknown     -> nack("unsupported_command:<command>")
```

The handler must not dial a real number. Real telephony belongs to a later S9 bridge package.

### Native Android package

Use package path:

```text
android_agent/android/app/src/main/kotlin/com/tooltelesales/boxphone_agent/
```

Required classes:

- `MainActivity.kt`
- `AgentForegroundService.kt`

Required method channel:

```text
boxphone_agent/native
```

Required methods:

- `startForegroundService`
- `stopForegroundService`
- `getNativeStatus`

`getNativeStatus` returns:

```json
{
  "serviceRunning": true,
  "bridgeMode": "simulated"
}
```

---

## Detailed Test Matrix

### Config tests

- `AgentConfig.toJson` and `fromJson` round-trip all fields.
- Default heartbeat interval is 5 seconds.
- Default poll interval is 2 seconds.
- Blank Gateway URL fails validation.
- Relative Gateway URL fails validation.
- Blank device id fails validation.
- Blank token fails validation.
- Audio port 0 and 65536 fail validation.

### Gateway client tests

- Register sends `X-Device-Token`.
- Register body contains `device_id`, `ip_address`, `app_version`, `audio_port`.
- Empty command response parses as `null`.
- Command response parses command id, command, call id, payload.
- ACK body is `{"status":"acked"}`.
- NACK body is `{"status":"nacked","error":"telephony_failed"}`.
- HTTP 404 creates non-retryable exception.
- HTTP 500 creates retryable exception.
- Socket/timeout error creates retryable exception.

### Controller tests

- `registerOnce` logs success and updates state.
- `heartbeatOnce` calls client with current config.
- `pollOnce` does nothing when no command exists.
- `pollOnce` ACKs `PING`.
- `pollOnce` ACKs `DIAL` and sets active call id.
- `pollOnce` NACKs unsupported command.
- `stopLoops` cancels timers and leaves no running loop.

### UI tests

- Renders `Boxphone Agent`.
- Save config button persists config through store.
- Invalid URL shows validation text.
- Register button invokes controller.
- Start/stop buttons change visible status.
- Logs area shows newest log line.

### Native bridge tests

- `PlatformBridge.startForegroundService` invokes method channel with exact method name.
- `PlatformBridge.stopForegroundService` invokes exact method name.
- `PlatformBridge.getNativeStatus` parses `serviceRunning` and `bridgeMode`.

---

## Delivery Gate

This package is complete only when:

- `flutter test` passes inside `android_agent/`.
- `flutter analyze` passes inside `android_agent/`.
- Gateway tests still pass from repo root.
- APK build command is documented even if local machine lacks Android SDK.
- The app can run in simulator mode without S9 hardware.
