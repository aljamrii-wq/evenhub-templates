import 'dart:async';

import 'package:aura_app/models/even_hub_bridge_message.dart';

typedef EvenHubPayloadHandler = FutureOr<Map<String, dynamic>> Function(
  Map<String, dynamic> payload,
);

class EvenHubBridgeHandlers {
  const EvenHubBridgeHandlers({
    this.onCreateStartUpPageContainer,
    this.onTextContainerUpgrade,
    this.onUpdateImageRawData,
    this.onImuControl,
    this.onGetDeviceInfo,
    this.onShutDownPageContainer,
    this.onLog,
  });

  final EvenHubPayloadHandler? onCreateStartUpPageContainer;
  final EvenHubPayloadHandler? onTextContainerUpgrade;
  final EvenHubPayloadHandler? onUpdateImageRawData;
  final EvenHubPayloadHandler? onImuControl;
  final EvenHubPayloadHandler? onGetDeviceInfo;
  final EvenHubPayloadHandler? onShutDownPageContainer;
  final void Function(Map<String, dynamic> payload)? onLog;
}

class EvenHubBridge {
  EvenHubBridge({
    EvenHubBridgeHandlers handlers = const EvenHubBridgeHandlers(),
  }) : _handlers = handlers;

  final EvenHubBridgeHandlers _handlers;

  Future<EvenHubBridgeResponse> handleJsonMessage(String raw) async {
    try {
      return await handleMessage(EvenHubBridgeMessage.fromJsonString(raw));
    } on FormatException catch (error) {
      return EvenHubBridgeResponse.failure('invalid', error.message);
    }
  }

  Future<EvenHubBridgeResponse> handleMessage(
    EvenHubBridgeMessage message,
  ) async {
    try {
      final payload = await _dispatch(message);
      return EvenHubBridgeResponse.success(message.id, payload: payload);
    } catch (error) {
      return EvenHubBridgeResponse.failure(message.id, error.toString());
    }
  }

  Future<Map<String, dynamic>> _dispatch(EvenHubBridgeMessage message) async {
    switch (message.action) {
      case EvenHubBridgeAction.ready:
        return {'ready': true};
      case EvenHubBridgeAction.log:
        _handlers.onLog?.call(message.payload);
        return {'logged': true};
      case EvenHubBridgeAction.createStartUpPageContainer:
        return _callOrAck(
          _handlers.onCreateStartUpPageContainer,
          message.payload,
        );
      case EvenHubBridgeAction.textContainerUpgrade:
        return _callOrAck(_handlers.onTextContainerUpgrade, message.payload);
      case EvenHubBridgeAction.updateImageRawData:
        return _callOrAck(_handlers.onUpdateImageRawData, message.payload);
      case EvenHubBridgeAction.imuControl:
        return _callOrAck(_handlers.onImuControl, message.payload);
      case EvenHubBridgeAction.getDeviceInfo:
        return _callOrAck(
          _handlers.onGetDeviceInfo,
          message.payload,
          fallback: {
            'platform': 'aura_flutter',
            'model': 'G2',
            'bridge': 'even_hub_webview',
          },
        );
      case EvenHubBridgeAction.shutDownPageContainer:
        return _callOrAck(_handlers.onShutDownPageContainer, message.payload);
      case EvenHubBridgeAction.unknown:
        throw UnsupportedError('Unsupported bridge action.');
    }
  }

  Future<Map<String, dynamic>> _callOrAck(
    EvenHubPayloadHandler? handler,
    Map<String, dynamic> payload, {
    Map<String, dynamic> fallback = const {'ok': true},
  }) async {
    if (handler == null) {
      return fallback;
    }
    return handler(payload);
  }
}
