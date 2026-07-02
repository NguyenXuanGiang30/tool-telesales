import 'dart:convert';
import 'package:http/http.dart' as http;

class GatewayClient {
  final String baseUrl;
  final String deviceId;
  final String deviceToken;

  GatewayClient({
    required this.baseUrl,
    required this.deviceId,
    this.deviceToken = '',
  });

  Map<String, String> _jsonHeaders() {
    return {
      'Content-Type': 'application/json',
      if (deviceToken.isNotEmpty) 'X-Device-Token': deviceToken,
    };
  }

  Future<bool> registerDevice({
    required String ipAddress,
    required String appVersion,
    required int audioPort,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/devices/register'),
        headers: _jsonHeaders(),
        body: jsonEncode({
          'device_id': deviceId,
          'ip_address': ipAddress,
          'app_version': appVersion,
          'audio_port': audioPort,
          if (deviceToken.isNotEmpty) 'device_token': deviceToken,
        }),
      );
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<bool> sendHeartbeat({
    required int batteryPercent,
    required double temperatureC,
    required int signalDbm,
    required bool charging,
    required String networkType,
    required int storageFreeMb,
  }) async {
    try {
      final heartbeatResponse = await http.post(
        Uri.parse('$baseUrl/devices/$deviceId/heartbeat'),
        headers: _jsonHeaders(),
      );
      if (heartbeatResponse.statusCode != 200) {
        return false;
      }

      final healthResponse = await http.post(
        Uri.parse('$baseUrl/devices/$deviceId/health'),
        headers: _jsonHeaders(),
        body: jsonEncode({
          'battery_percent': batteryPercent,
          'temperature_c': temperatureC,
          'signal_dbm': signalDbm,
          'charging': charging,
          'network_type': networkType,
          'storage_free_mb': storageFreeMb,
        }),
      );
      return healthResponse.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<Map<String, dynamic>?> pollNextCommand() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/devices/$deviceId/commands/next'),
        headers: _jsonHeaders(),
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
        headers: _jsonHeaders(),
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

  Future<bool> completeCall(String callId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/calls/$callId/complete'),
        headers: _jsonHeaders(),
      );
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
