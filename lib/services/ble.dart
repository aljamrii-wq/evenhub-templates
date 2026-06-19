import 'dart:typed_data';

/// Nordic UART Service UUIDs for G2 smart glasses.
///
/// The glasses expose two peripherals (left + right temple),
/// matched by channel number in the advertising name:
///   {prefix}_{chan}_L_{id} / {prefix}_{chan}_R_{id}
class BleUuids {
  BleUuids._();

  /// Nordic UART Service
  static const String uartService = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';

  /// TX characteristic — phone writes commands to glasses
  static const String uartTx = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';

  /// RX characteristic — phone subscribes to notifications from glasses
  static const String uartRx = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';
}

class BleReceive {
  String lr = "";
  Uint8List data = Uint8List(0);
  String type = "";
  bool isTimeout = false;
 
  int getCmd() {
    return data[0].toInt();
  }

  BleReceive();
  static BleReceive fromMap(Map map) {
    var ret = BleReceive();
    ret.lr = map["lr"];
    ret.data = map["data"];
    ret.type = map["type"];
    return ret;
  }

  String hexStringData() {
    return data.map((e) => e.toRadixString(16).padLeft(2, '0')).join(' ');
  }
}

enum BleEvent {
  exitFunc,
  nextPageForEvenAI,
  upHeader,
  downHeader,
  glassesConnectSuccess, // 17、Bluetooth binding successful
  evenaiStart, // 23 Notify the phone to start Even AI
  evenaiRecordOver, // 24 Even AI recording ends
}