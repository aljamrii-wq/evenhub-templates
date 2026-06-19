import 'dart:convert';

import 'package:aura_app/localization/aura_app_strings.dart';
import 'package:aura_app/models/even_hub_bridge_message.dart';
import 'package:aura_app/services/even_hub_bridge.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class EhpkAppLaunch {
  const EhpkAppLaunch({
    required this.title,
    this.sourceUri,
    this.html,
  }) : assert(sourceUri != null || html != null);

  final String title;
  final Uri? sourceUri;
  final String? html;

  factory EhpkAppLaunch.sample(AuraAppStrings strings) {
    final direction = strings.textDirection == TextDirection.rtl ? 'rtl' : 'ltr';
    return EhpkAppLaunch(
      title: strings.evenHubAppTitle,
      html: '''
<!doctype html>
<html lang="${strings.locale.languageCode}" dir="$direction">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>${strings.evenHubAppTitle}</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #101214;
      color: #f8fafc;
      display: grid;
      min-height: 100vh;
      place-items: center;
    }
    main {
      width: min(88vw, 420px);
      padding: 24px;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 8px;
      background: #171a1f;
    }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p { line-height: 1.5; color: #cbd5e1; }
    code { color: #93c5fd; }
  </style>
</head>
<body>
  <main>
    <h1>${strings.evenHubSampleHeading}</h1>
    <p>${strings.evenHubSampleBody}</p>
    <p id="status">${strings.evenHubLoading}</p>
  </main>
  <script>
    const bridge = window.EvenAppBridge.getInstance();
    bridge.createStartUpPageContainer({ containerId: 1, width: 640, height: 200 })
      .then(() => bridge.getDeviceInfo())
      .then((info) => {
        document.getElementById('status').textContent =
          '${strings.evenHubBridgeReady}: ' + (info.bridge || 'native');
      })
      .catch((error) => {
        document.getElementById('status').textContent =
          '${strings.evenHubBridgeError}: ' + error.message;
      });
  </script>
</body>
</html>
''',
    );
  }
}

class EhpkWebViewPage extends StatefulWidget {
  const EhpkWebViewPage({
    super.key,
    required this.launch,
    this.bridge,
  });

  final EhpkAppLaunch launch;
  final EvenHubBridge? bridge;

  @override
  State<EhpkWebViewPage> createState() => _EhpkWebViewPageState();
}

class _EhpkWebViewPageState extends State<EhpkWebViewPage> {
  static const _channelName = 'AuraEvenHubBridge';

  late final WebViewController _controller;
  late final EvenHubBridge _bridge;
  int _progress = 0;
  String? _lastError;

  @override
  void initState() {
    super.initState();
    _bridge = widget.bridge ?? EvenHubBridge();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel(
        _channelName,
        onMessageReceived: _handleJavaScriptMessage,
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (progress) => setState(() => _progress = progress),
          onPageFinished: (_) => _installBridgeShim(),
          onWebResourceError: (error) {
            setState(() => _lastError = error.description);
          },
        ),
      );
    _loadApp();
  }

  Future<void> _loadApp() async {
    final html = widget.launch.html;
    if (html != null) {
      await _controller.loadHtmlString(_wrapHtmlWithBridgeShim(html));
      return;
    }
    await _controller.loadRequest(widget.launch.sourceUri!);
  }

  Future<void> _installBridgeShim() {
    return _controller.runJavaScript(_bridgeShimScript);
  }

  Future<void> _handleJavaScriptMessage(JavaScriptMessage message) async {
    final response = await _bridge.handleJsonMessage(message.message);
    if (!mounted) return;
    if (!response.ok) {
      setState(() => _lastError = response.error);
    }
    await _controller.runJavaScript(_bridgeReceiveScript(response));
  }

  String _wrapHtmlWithBridgeShim(String html) {
    final script = '<script>$_bridgeShimScript</script>';
    if (html.contains('</head>')) {
      return html.replaceFirst('</head>', '$script</head>');
    }
    return '$script$html';
  }

  String _bridgeReceiveScript(EvenHubBridgeResponse response) {
    return 'window.__AuraBridgeReceive(${jsonEncode(response.toJson())});';
  }

  String get _bridgeShimScript => '''
(function () {
  if (window.__AuraBridgeInstalled) return;
  window.__AuraBridgeInstalled = true;

  const pending = {};
  let sequence = 0;

  function post(action, payload) {
    const id = 'ehpk-' + Date.now() + '-' + (++sequence);
    const message = { id: id, action: action, payload: payload || {} };
    return new Promise(function (resolve, reject) {
      pending[id] = { resolve: resolve, reject: reject };
      window.$_channelName.postMessage(JSON.stringify(message));
    });
  }

  window.__AuraBridgeReceive = function (response) {
    const entry = pending[response.id];
    if (!entry) return;
    delete pending[response.id];
    if (response.ok) {
      entry.resolve(response.payload || {});
    } else {
      entry.reject(new Error(response.error || 'Bridge request failed'));
    }
  };

  const api = {
    ready: true,
    onReady: function (callback) {
      if (typeof callback === 'function') {
        setTimeout(function () { callback(api); }, 0);
      }
    },
    createStartUpPageContainer: function (request) {
      return post('${EvenHubBridgeAction.createStartUpPageContainer.wireName}', request);
    },
    textContainerUpgrade: function (request) {
      return post('${EvenHubBridgeAction.textContainerUpgrade.wireName}', request);
    },
    updateImageRawData: function (request) {
      return post('${EvenHubBridgeAction.updateImageRawData.wireName}', request);
    },
    imuControl: function (enable, intervalMs) {
      return post('${EvenHubBridgeAction.imuControl.wireName}', {
        enable: Boolean(enable),
        intervalMs: intervalMs
      });
    },
    getDeviceInfo: function () {
      return post('${EvenHubBridgeAction.getDeviceInfo.wireName}', {});
    },
    shutDownPageContainer: function (containerId) {
      return post('${EvenHubBridgeAction.shutDownPageContainer.wireName}', {
        containerId: containerId
      });
    },
    log: function (message) {
      return post('${EvenHubBridgeAction.log.wireName}', { message: message });
    }
  };

  window.EvenAppBridge = window.EvenAppBridge || {
    getInstance: function () { return api; }
  };
})();
''';

  @override
  Widget build(BuildContext context) {
    final strings = AuraAppStrings.of(Localizations.localeOf(context));
    return Directionality(
      textDirection: strings.textDirection,
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.launch.title),
        ),
        body: Column(
          children: [
            if (_progress < 100) LinearProgressIndicator(value: _progress / 100),
            if (_lastError != null)
              MaterialBanner(
                content: Text('${strings.evenHubBridgeError}: $_lastError'),
                actions: [
                  TextButton(
                    onPressed: () => setState(() => _lastError = null),
                    child: Text(strings.dismiss),
                  ),
                ],
              ),
            Expanded(
              child: WebViewWidget(controller: _controller),
            ),
          ],
        ),
      ),
    );
  }
}
