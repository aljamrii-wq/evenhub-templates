/// Central configuration for the Aura app.
///
/// All addresses, timeouts, and tunables live here.
/// In production these would come from a .env / build-config / remote config system.
///
/// **Security:** Default endpoints use plain ws:// and http:// because
/// all traffic flows through Tailscale's WireGuard-encrypted tunnel.
/// For non-Tailscale deployments, use the wss:// and https:// variants
/// and point Hermes Bridge behind a TLS-terminating reverse proxy (nginx/Caddy).
class AuraConfig {
  /// Hermes Bridge WebSocket URL (Tailscale-encrypted tunnel).
  static const String hermesBridgeWsUrl = 'ws://100.76.131.27:8787';

  /// Hermes Bridge secure WebSocket URL (for non-Tailscale deployments).
  static const String hermesBridgeWssUrl = 'wss://100.76.131.27:8787';

  /// Aura Engine HTTP base URL (Tailscale-encrypted tunnel).
  static const String auraEngineHttpBase = 'http://100.76.131.27:8000';

  /// Aura Engine HTTPS base URL (for non-Tailscale deployments).
  static const String auraEngineHttpsBase = 'https://100.76.131.27:8000';

  /// Maximum BLE reconnection attempts.
  static const int bleMaxReconnectAttempts = 5;

  /// Delay between BLE reconnection attempts.
  static const Duration bleReconnectDelay = Duration(seconds: 5);

  /// Heartbeat interval sent to connected glasses.
  static const Duration bleHeartbeatInterval = Duration(seconds: 8);

  /// Maximum EvenAI recording duration in seconds.
  static const int evenAiMaxRecordingDuration = 30;

  /// Auto-pagination interval for EvenAI text display.
  static const Duration evenAiPaginationInterval = Duration(seconds: 5);

  /// Text-to-glasses page interval.
  static const Duration textPageInterval = Duration(seconds: 8);

  /// Hermes Bridge WebSocket connection timeout.
  static const Duration wsConnectTimeout = Duration(seconds: 10);

  /// Hermes Bridge max reconnection attempts.
  static const int wsMaxReconnectAttempts = 5;

  /// Hermes Bridge reconnection delay.
  static const Duration wsReconnectDelay = Duration(seconds: 2);
}
