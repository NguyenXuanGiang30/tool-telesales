import 'package:shared_preferences/shared_preferences.dart';

class ConfigStore {
  static const String _keyGatewayUrl = 'gateway_url';
  static const String _keyDeviceId = 'device_id';
  static const String _keyAudioPort = 'audio_port';
  static const String _keySimSlot = 'sim_slot';

  static Future<void> saveConfig({
    required String gatewayUrl,
    required String deviceId,
    required int audioPort,
    required int simSlot,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyGatewayUrl, gatewayUrl);
    await prefs.setString(_keyDeviceId, deviceId);
    await prefs.setInt(_keyAudioPort, audioPort);
    await prefs.setInt(_keySimSlot, simSlot);
  }

  static Future<Map<String, dynamic>> loadConfig() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      'gatewayUrl': prefs.getString(_keyGatewayUrl) ?? 'http://10.0.2.2:8000/api/v1',
      'deviceId': prefs.getString(_keyDeviceId) ?? 'S9_AGENT_01',
      'audioPort': prefs.getInt(_keyAudioPort) ?? 28000,
      'simSlot': prefs.getInt(_keySimSlot) ?? 1,
    };
  }
}
