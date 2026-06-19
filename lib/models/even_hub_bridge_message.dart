import 'dart:convert';

enum EvenHubBridgeAction {
  ready,
  log,
  createStartUpPageContainer,
  textContainerUpgrade,
  updateImageRawData,
  imuControl,
  getDeviceInfo,
  shutDownPageContainer,
  unknown,
}

extension EvenHubBridgeActionWire on EvenHubBridgeAction {
  String get wireName {
    switch (this) {
      case EvenHubBridgeAction.ready:
        return 'ready';
      case EvenHubBridgeAction.log:
        return 'log';
      case EvenHubBridgeAction.createStartUpPageContainer:
        return 'createStartUpPageContainer';
      case EvenHubBridgeAction.textContainerUpgrade:
        return 'textContainerUpgrade';
      case EvenHubBridgeAction.updateImageRawData:
        return 'updateImageRawData';
      case EvenHubBridgeAction.imuControl:
        return 'imuControl';
      case EvenHubBridgeAction.getDeviceInfo:
        return 'getDeviceInfo';
      case EvenHubBridgeAction.shutDownPageContainer:
        return 'shutDownPageContainer';
      case EvenHubBridgeAction.unknown:
        return 'unknown';
    }
  }

  static EvenHubBridgeAction fromWireName(String? name) {
    switch (name) {
      case 'ready':
        return EvenHubBridgeAction.ready;
      case 'log':
        return EvenHubBridgeAction.log;
      case 'createStartUpPageContainer':
        return EvenHubBridgeAction.createStartUpPageContainer;
      case 'textContainerUpgrade':
        return EvenHubBridgeAction.textContainerUpgrade;
      case 'updateImageRawData':
        return EvenHubBridgeAction.updateImageRawData;
      case 'imuControl':
        return EvenHubBridgeAction.imuControl;
      case 'getDeviceInfo':
        return EvenHubBridgeAction.getDeviceInfo;
      case 'shutDownPageContainer':
        return EvenHubBridgeAction.shutDownPageContainer;
      default:
        return EvenHubBridgeAction.unknown;
    }
  }
}

class EvenHubBridgeMessage {
  const EvenHubBridgeMessage({
    required this.id,
    required this.action,
    required this.payload,
  });

  final String id;
  final EvenHubBridgeAction action;
  final Map<String, dynamic> payload;

  factory EvenHubBridgeMessage.fromJsonString(String raw) {
    final decoded = jsonDecode(raw);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('Bridge message must be a JSON object.');
    }
    return EvenHubBridgeMessage.fromJson(decoded);
  }

  factory EvenHubBridgeMessage.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final action = json['action'];
    final payload = json['payload'];

    if (id is! String || id.trim().isEmpty) {
      throw const FormatException('Bridge message id is required.');
    }
    if (action is! String || action.trim().isEmpty) {
      throw const FormatException('Bridge message action is required.');
    }
    if (payload != null && payload is! Map<String, dynamic>) {
      throw const FormatException('Bridge message payload must be an object.');
    }

    return EvenHubBridgeMessage(
      id: id,
      action: EvenHubBridgeActionWire.fromWireName(action),
      payload: payload == null ? <String, dynamic>{} : Map.of(payload),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'action': action.wireName,
        'payload': payload,
      };
}

class EvenHubBridgeResponse {
  const EvenHubBridgeResponse({
    required this.id,
    required this.ok,
    required this.payload,
    this.error,
  });

  factory EvenHubBridgeResponse.success(
    String id, {
    Map<String, dynamic> payload = const <String, dynamic>{},
  }) {
    return EvenHubBridgeResponse(
      id: id,
      ok: true,
      payload: payload,
    );
  }

  factory EvenHubBridgeResponse.failure(String id, String error) {
    return EvenHubBridgeResponse(
      id: id,
      ok: false,
      payload: const <String, dynamic>{},
      error: error,
    );
  }

  final String id;
  final bool ok;
  final Map<String, dynamic> payload;
  final String? error;

  Map<String, dynamic> toJson() => {
        'id': id,
        'ok': ok,
        'payload': payload,
        if (error != null) 'error': error,
      };

  String toJsonString() => jsonEncode(toJson());
}
