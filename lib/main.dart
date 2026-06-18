
import 'package:aura_app/ble_manager.dart';
import 'package:aura_app/controllers/evenai_model_controller.dart';
import 'package:aura_app/views/home_page.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';


void main() {
  BleManager.get();
  Get.put(EvenaiModelController());
  
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Aura',
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF6C63FF),
        brightness: Brightness.dark,
      ),
      home: HomePage(), 
    );
  }
}
