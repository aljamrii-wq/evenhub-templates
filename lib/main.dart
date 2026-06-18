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

class MyApp extends StatelessWidget {
  const MyApp({super.key});

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
