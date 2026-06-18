import 'package:aura_app/ble_manager.dart';
import 'package:aura_app/controllers/evenai_model_controller.dart';
import 'package:aura_app/services/imu_service.dart';
import 'package:aura_app/services/mode_detector.dart';
import 'package:aura_app/views/home_page.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

void main() {
  // Initialize BLE manager
  BleManager.get();

  // Initialize mode detector
  ModeDetector.get.startListening();

  // Initialize IMU service (lazy-start — activated on glasses connect)
  ImuService.get;

  // Initialize state controller
  Get.put(EvenaiModelController());

  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
        // App is backgrounded — release BLE resources
        _handleBackground();
        break;
      case AppLifecycleState.resumed:
        // App is foregrounded — reconnect if needed
        _handleForeground();
        break;
      case AppLifecycleState.detached:
        // App is being killed — full cleanup
        _handleDetached();
        break;
      case AppLifecycleState.hidden:
        // Flutter view is hidden but app still active (iOS multitasking)
        break;
    }
  }

  void _handleBackground() {
    if (BleManager.get.isConnected) {
      // Keep connection alive (bluetooth-central background mode),
      // but suspend UI updates and heartbeat timer
      BleManager.get.suspendHeartbeat();
    }
  }

  void _handleForeground() {
    if (!BleManager.get.isConnected && BleManager.get.pairedGlasses.isNotEmpty) {
      BleManager.get.resumeHeartbeat();
    }
  }

  void _handleDetached() {
    BleManager.get.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Aura',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF6C63FF),
        brightness: Brightness.dark,
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}
