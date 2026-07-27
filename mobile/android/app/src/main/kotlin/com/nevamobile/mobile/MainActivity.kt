package com.nevamobile.mobile

import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Lisans sistemi için cihaz kimliği köprüsü: Settings.Secure.ANDROID_ID tek
 * satırlık bir Android API çağrısı olduğundan üçüncü parti bir paket yerine
 * doğrudan burada okunuyor (bkz. lib/core/license/device_id.dart).
 */
class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.nevamobile.mobile/device"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "getAndroidId") {
                val id = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
                result.success(id)
            } else {
                result.notImplemented()
            }
        }
    }
}
