import 'dart:async';
import 'package:flutter/foundation.dart';
import 'gateway_client.dart';

enum AgentState {
  disconnected,
  registering,
  idle,
  dialing,
  ringing,
  connected,
  completed,
  failed,
}

class AgentController extends ChangeNotifier {
  String gatewayUrl = 'http://10.0.2.2:8000/api/v1';
  String deviceId = 'S9_AGENT_01';
  String deviceToken = '';
  int audioPort = 28000;
  int simSlot = 1;

  // Mock Health variables
  int batteryPercent = 85;
  double temperatureC = 35.0;
  int signalDbm = -75;
  bool charging = false;
  String networkType = 'LTE';
  int storageFreeMb = 2048;

  AgentState _state = AgentState.disconnected;
  AgentState get state => _state;

  String? _activeCallId;
  String? get activeCallId => _activeCallId;

  String? _activePhoneNumber;
  String? get activePhoneNumber => _activePhoneNumber;

  bool _isPolling = false;
  bool get isPolling => _isPolling;

  final List<String> _logs = [];
  List<String> get logs => List.unmodifiable(_logs);

  Timer? _pollTimer;
  GatewayClient? _client;

  void addLog(String message) {
    final timestamp = DateTime.now().toIso8601String().substring(11, 19);
    _logs.insert(0, '[$timestamp] $message');
    if (_logs.length > 100) {
      _logs.removeLast();
    }
    notifyListeners();
  }

  void updateHealth({
    int? battery,
    double? temp,
    int? signal,
    bool? charge,
    String? network,
    int? storage,
  }) {
    if (battery != null) batteryPercent = battery;
    if (temp != null) temperatureC = temp;
    if (signal != null) signalDbm = signal;
    if (charge != null) charging = charge;
    if (network != null) networkType = network;
    if (storage != null) storageFreeMb = storage;
    addLog('Updated device metrics: Battery=$batteryPercent%, Temp=$temperatureC°C, Signal=$signalDbm dBm');
    notifyListeners();
  }

  Future<void> start(Map<String, dynamic> config) async {
    if (_isPolling) return;

    gatewayUrl = config['gatewayUrl'];
    deviceId = config['deviceId'];
    deviceToken = config['deviceToken'] ?? '';
    audioPort = config['audioPort'];
    simSlot = config['simSlot'];

    _client = GatewayClient(
      baseUrl: gatewayUrl,
      deviceId: deviceId,
      deviceToken: deviceToken,
    );
    _isPolling = true;
    _state = AgentState.registering;
    addLog(
      'Starting agent polling loop. Device ID: $deviceId, Gateway: $gatewayUrl',
    );
    notifyListeners();

    // Perform initial registration
    await _register();

    _pollTimer = Timer.periodic(const Duration(seconds: 2), (timer) async {
      if (!_isPolling) return;
      await _heartbeat();
      await _pollCommand();
    });
  }

  void stop() {
    _isPolling = false;
    _pollTimer?.cancel();
    _pollTimer = null;
    _state = AgentState.disconnected;
    _activeCallId = null;
    _activePhoneNumber = null;
    addLog('Stopped agent polling loop');
    notifyListeners();
  }

  Future<void> _register() async {
    if (_client == null) return;
    addLog('Attempting to register device with gateway...');
    final ok = await _client!.registerDevice(
      ipAddress: '127.0.0.1',
      appVersion: '1.0.0',
      audioPort: audioPort,
    );
    if (ok) {
      _state = AgentState.idle;
      addLog('Registration successful. Status: IDLE');
    } else {
      _state = AgentState.disconnected;
      addLog('Registration failed. Will retry on next cycle.');
    }
    notifyListeners();
  }

  Future<void> _heartbeat() async {
    if (_client == null || _state == AgentState.registering) return;
    
    final ok = await _client!.sendHeartbeat(
      batteryPercent: batteryPercent,
      temperatureC: temperatureC,
      signalDbm: signalDbm,
      charging: charging,
      networkType: networkType,
      storageFreeMb: storageFreeMb,
    );

    if (!ok && _state != AgentState.disconnected) {
      addLog('Heartbeat failed. Gateway may be unreachable.');
    }
  }

  Future<void> _pollCommand() async {
    if (_client == null || _state == AgentState.registering || _state == AgentState.disconnected) return;

    final cmd = await _client!.pollNextCommand();
    if (cmd != null) {
      final commandId = cmd['command_id'];
      final commandName = cmd['command'];
      final payload = cmd['payload'] as Map<String, dynamic>;
      final callId = cmd['call_id'] as String?;

      addLog('Received command: $commandName (ID: $commandId)');

      if (commandName == 'DIAL') {
        final phoneNumber = payload['phone_number'] as String?;
        if (phoneNumber == null) {
          await _client!.acknowledgeCommand(
            commandId: commandId,
            status: 'nacked',
            error: 'missing_phone_number',
          );
          addLog('Nacked command $commandId: missing_phone_number');
          return;
        }

        if (_state == AgentState.dialing || _state == AgentState.ringing || _state == AgentState.connected) {
          await _client!.acknowledgeCommand(
            commandId: commandId,
            status: 'nacked',
            error: 'device_busy',
          );
          addLog('Nacked command $commandId: device_busy');
          return;
        }

        // Ack the command
        await _client!.acknowledgeCommand(commandId: commandId, status: 'acked');
        addLog('Acked DIAL command $commandId. Executing telephony simulation...');
        _simulateTelephonyCall(callId ?? 'unknown_call', phoneNumber);
      } else if (commandName == 'HANGUP') {
        if (_activeCallId != null && _activeCallId == callId) {
          await _client!.acknowledgeCommand(commandId: commandId, status: 'acked');
          addLog('Acked HANGUP command $commandId. Hanging up...');
          _hangupCall();
        } else {
          await _client!.acknowledgeCommand(
            commandId: commandId,
            status: 'nacked',
            error: 'invalid_call_id',
          );
          addLog('Nacked HANGUP command $commandId: invalid_call_id');
        }
      } else {
        await _client!.acknowledgeCommand(
          commandId: commandId,
          status: 'nacked',
          error: 'unsupported_command',
        );
        addLog('Nacked command $commandId: unsupported_command');
      }
    }
  }

  void _simulateTelephonyCall(String callId, String phoneNumber) {
    _activeCallId = callId;
    _activePhoneNumber = phoneNumber;
    _state = AgentState.dialing;
    addLog('Telephony state: DIALING $phoneNumber');
    notifyListeners();

    // Transition: DIALING -> RINGING after 1.5s
    Timer(const Duration(milliseconds: 1500), () {
      if (_activeCallId != callId) return;
      _state = AgentState.ringing;
      addLog('Telephony state: RINGING');
      notifyListeners();

      // Transition: RINGING -> CONNECTED after 2s
      Timer(const Duration(seconds: 2), () {
        if (_activeCallId != callId) return;
        _state = AgentState.connected;
        addLog('Telephony state: CONNECTED');
        notifyListeners();
        
        // Simulating speech dialog sequence in mock telephony
        _simulateSpeechSequence(callId);
      });
    });
  }

  void _simulateSpeechSequence(String callId) {
    // Phase 1: AI introduction simulator turn after 3 seconds
    Timer(const Duration(seconds: 3), () {
      if (_activeCallId != callId || _state != AgentState.connected) return;
      addLog('Audio Rx Frame: (AI TTS greeting turn received from Gateway)');
      addLog('Audio Tx Frame: "Dạ em nghe ạ, ai đấy ạ?" (Simulating customer speaking)');
    });

    // Phase 2: AI pitch turn after 7 seconds
    Timer(const Duration(seconds: 7), () {
      if (_activeCallId != callId || _state != AgentState.connected) return;
      addLog('Audio Rx Frame: (AI TTS product pitch turn received from Gateway)');
      addLog('Audio Tx Frame: "Dạ em không quan tâm đâu ạ, cảm ơn nhé" (Simulating customer refusing)');
    });

    // Phase 3: AI closing / auto-hangup after 12 seconds
    Timer(const Duration(seconds: 12), () {
      if (_activeCallId != callId || _state != AgentState.connected) return;
      addLog('Audio Rx Frame: (AI TTS closing hangup turn received from Gateway)');
      _state = AgentState.completed;
      addLog('Telephony state: DISCONNECTED (completed)');
      _activeCallId = null;
      _activePhoneNumber = null;
      notifyListeners();
    });
  }

  void _hangupCall() {
    _state = AgentState.idle;
    _activeCallId = null;
    _activePhoneNumber = null;
    addLog('Call hung up manually/via remote HANGUP command');
    notifyListeners();
  }
}
