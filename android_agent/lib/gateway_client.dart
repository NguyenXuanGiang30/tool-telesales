import 'dart:convert';
import 'package:http/http.dart' as http;

class GatewayClient {
  final String baseUrl;
  final String deviceId;

  GatewayClient({required this.baseUrl, required this.deviceId});

  Future<bool> registerDevice({
    required String ipAddress,
    required String appVersion,
    required int audioPort,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/devices/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'device_id': deviceId,
          'ip_address': ipAddress,
          'app_version': appVersion,
          'audio_port': audioPort,
        }),
      );
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<bool> sendHeartbeat({
    required String status,
    required String? activeCallId,
    required int batteryPercent,
    required double temperatureC,
    required int signalDbm,
    required bool charging,
    required String networkType,
    required int storageFreeMb,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/devices/$deviceId/heartbeat'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'status': status,
          'active_call_id': activeCallId,
          'health': {
            'battery_percent': batteryPercent,
            'temperature_c': temperatureC,
            'signal_dbm': signalDbm,
            'charging': charging,
            'network_type': networkType,
            'storage_free_mb': storageFreeMb,
          }
        }),
      );
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<Map<String, dynamic>?> pollNextCommand() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/devices/$deviceId/commands/next'),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['command'];
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<bool> acknowledgeCommand({
    required String commandId,
    required String status,
    String? error,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/devices/$deviceId/commands/$commandId/ack'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'status': status,
          'error': error,
        }),
      );
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
