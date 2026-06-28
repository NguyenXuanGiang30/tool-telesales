import 'package:flutter/material.dart';
import 'agent_controller.dart';
import 'config_store.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Boxphone Android Agent Shell',
      theme: ThemeData(
        brightness: Brightness.dark,
        primarySwatch: Colors.indigo,
        scaffoldBackgroundColor: const Color(0xFF0F172A), // Slate 900
        cardTheme: const CardThemeData(
          color: Color(0xFF1E293B), // Slate 800
          elevation: 4,
          margin: EdgeInsets.zero,
        ),
      ),
      home: const AgentHomeScreen(),
    );
  }
}

class AgentHomeScreen extends StatefulWidget {
  const AgentHomeScreen({super.key});

  @override
  State<AgentHomeScreen> createState() => _AgentHomeScreenState();
}

class _AgentHomeScreenState extends State<AgentHomeScreen> {
  final _controller = AgentController();
  final _gatewayUrlController = TextEditingController();
  final _deviceIdController = TextEditingController();
  final _deviceTokenController = TextEditingController();
  final _audioPortController = TextEditingController();
  final _simSlotController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadSavedConfig();
    _controller.addListener(_onControllerStateChanged);
  }

  void _onControllerStateChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _loadSavedConfig() async {
    final config = await ConfigStore.loadConfig();
    _gatewayUrlController.text = config['gatewayUrl'];
    _deviceIdController.text = config['deviceId'];
    _deviceTokenController.text = config['deviceToken'];
    _audioPortController.text = config['audioPort'].toString();
    _simSlotController.text = config['simSlot'].toString();
  }

  Future<void> _saveAndStartAgent() async {
    final gatewayUrl = _gatewayUrlController.text.trim();
    final deviceId = _deviceIdController.text.trim();
    final deviceToken = _deviceTokenController.text.trim();
    final audioPort = int.tryParse(_audioPortController.text) ?? 28000;
    final simSlot = int.tryParse(_simSlotController.text) ?? 1;

    await ConfigStore.saveConfig(
      gatewayUrl: gatewayUrl,
      deviceId: deviceId,
      deviceToken: deviceToken,
      audioPort: audioPort,
      simSlot: simSlot,
    );

    await _controller.start({
      'gatewayUrl': gatewayUrl,
      'deviceId': deviceId,
      'deviceToken': deviceToken,
      'audioPort': audioPort,
      'simSlot': simSlot,
    });
  }

  void _stopAgent() {
    _controller.stop();
  }

  @override
  void dispose() {
    _controller.removeListener(_onControllerStateChanged);
    _controller.stop();
    _gatewayUrlController.dispose();
    _deviceIdController.dispose();
    _deviceTokenController.dispose();
    _audioPortController.dispose();
    _simSlotController.dispose();
    super.dispose();
  }

  Color _getStateColor(AgentState state) {
    switch (state) {
      case AgentState.idle:
        return const Color(0xFF10B981); // Emerald / Green
      case AgentState.dialing:
      case AgentState.ringing:
      case AgentState.connected:
        return Colors.blue;
      case AgentState.registering:
        return Colors.amber;
      case AgentState.disconnected:
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Boxphone Android Agent Shell'),
        backgroundColor: const Color(0xFF1E293B),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              _controller.addLog('Manual refresh triggered');
            },
          )
        ],
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Connection Status Header Banner
              _buildStatusHeader(),
              const SizedBox(height: 16),

              // Two columns: Settings & Telephony Control vs Metrics & Console Logs
              LayoutBuilder(
                builder: (context, constraints) {
                  if (constraints.maxWidth > 800) {
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            children: [
                              _buildSettingsCard(),
                              const SizedBox(height: 16),
                              _buildTelephonyCard(),
                            ],
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            children: [
                              _buildMetricsCard(),
                              const SizedBox(height: 16),
                              _buildConsoleLogsCard(),
                            ],
                          ),
                        ),
                      ],
                    );
                  } else {
                    return Column(
                      children: [
                        _buildSettingsCard(),
                        const SizedBox(height: 16),
                        _buildTelephonyCard(),
                        const SizedBox(height: 16),
                        _buildMetricsCard(),
                        const SizedBox(height: 16),
                        _buildConsoleLogsCard(),
                      ],
                    );
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusHeader() {
    return Card(
      color: const Color(0xFF1E293B),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: _getStateColor(_controller.state).withAlpha(76),
          width: 2,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          children: [
            Container(
              width: 16,
              height: 16,
              decoration: BoxDecoration(
                color: _getStateColor(_controller.state),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: _getStateColor(_controller.state).withAlpha(127),
                    blurRadius: 8,
                    spreadRadius: 2,
                  )
                ],
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Agent Status: ${_controller.state.name.toUpperCase()}',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _controller.isPolling
                        ? 'Connected & polling: ${_controller.gatewayUrl}'
                        : 'Agent disconnected. Settings are editable.',
                    style: TextStyle(
                      color: Colors.grey[400],
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            if (_controller.isPolling)
              ElevatedButton.icon(
                onPressed: _stopAgent,
                icon: const Icon(Icons.stop),
                label: const Text('STOP'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red[800],
                  foregroundColor: Colors.white,
                ),
              )
            else
              ElevatedButton.icon(
                onPressed: _saveAndStartAgent,
                icon: const Icon(Icons.play_arrow),
                label: const Text('START'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.indigo[600],
                  foregroundColor: Colors.white,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingsCard() {
    final enabled = !_controller.isPolling;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Gateway Connection Settings',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _gatewayUrlController,
              enabled: enabled,
              decoration: const InputDecoration(
                labelText: 'Gateway Base API URL',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _deviceIdController,
              enabled: enabled,
              decoration: const InputDecoration(
                labelText: 'Device Identifier (ID)',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _deviceTokenController,
              enabled: enabled,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Device Token',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _audioPortController,
                    enabled: enabled,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Audio Port (UDP)',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _simSlotController,
                    enabled: enabled,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'SIM Slot (1-4)',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTelephonyCard() {
    final activeCall = _controller.activeCallId != null;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Telephony Simulator Boundary',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            _buildStatRow('Telephony State', _controller.state.name.toUpperCase()),
            _buildStatRow('Active Call ID', _controller.activeCallId ?? 'None'),
            _buildStatRow('Phone Number', _controller.activePhoneNumber ?? 'None'),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: activeCall
                        ? () {
                            _controller.addLog('Manual Local Refusal Triggered');
                          }
                        : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.orange[800],
                      disabledBackgroundColor: Colors.grey[800],
                    ),
                    child: const Text('REFUSE CALL'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: activeCall
                        ? () {
                            _controller.addLog('Manual Telephony Hangup Triggered');
                          }
                        : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red[850],
                      disabledBackgroundColor: Colors.grey[800],
                    ),
                    child: const Text('LOCAL HANGUP'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricsCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Device Hardware Health Simulator',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Text('Battery Level: ${_controller.batteryPercent}%'),
            Slider(
              value: _controller.batteryPercent.toDouble(),
              min: 0,
              max: 100,
              divisions: 100,
              onChanged: (val) {
                _controller.updateHealth(battery: val.toInt());
              },
            ),
            Text('Temperature: ${_controller.temperatureC.toStringAsFixed(1)}°C'),
            Slider(
              value: _controller.temperatureC,
              min: 20,
              max: 70,
              divisions: 50,
              onChanged: (val) {
                _controller.updateHealth(temp: double.parse(val.toStringAsFixed(1)));
              },
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Charging Status:'),
                Switch(
                  value: _controller.charging,
                  onChanged: (val) {
                    _controller.updateHealth(charge: val);
                  },
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      _controller.updateHealth(battery: 5);
                      _controller.addLog('Simulated critical low battery event');
                    },
                    child: const Text('Drain Battery'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      _controller.updateHealth(temp: 65.5);
                      _controller.addLog('Simulated critical overheating event');
                    },
                    child: const Text('Simulate Heat'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConsoleLogsCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Polling & Action Logs Console',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                TextButton(
                  onPressed: () {
                    setState(() {
                      _controller.stop();
                    });
                  },
                  child: const Text('Clear Log', style: TextStyle(color: Colors.red)),
                )
              ],
            ),
            const SizedBox(height: 8),
            Container(
              height: 250,
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: ListView.builder(
                itemCount: _controller.logs.length,
                itemBuilder: (context, index) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2.0),
                    child: Text(
                      _controller.logs[index],
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: Colors.lightGreenAccent,
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[400])),
          Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }
}
