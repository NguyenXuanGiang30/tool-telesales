package com.autocall.gateway.boxphone_agent

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.content.Intent
import android.net.Uri
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.Manifest
import android.telephony.SubscriptionManager
import android.os.Build

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.autocall.gateway/telephony"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "makeCall" -> {
                    val phoneNumber = call.argument<String>("phoneNumber")
                    val simSlot = call.argument<Int>("simSlot") ?: 1
                    if (phoneNumber != null) {
                        val success = makeRealPhoneCall(phoneNumber, simSlot)
                        if (success) {
                            result.success(true)
                        } else {
                            result.error("CALL_FAILED", "Could not initiate call", null)
                        }
                    } else {
                        result.error("INVALID_ARGUMENT", "Phone number is null", null)
                    }
                }
                "requestPermissions" -> {
                    requestTelephonyPermissions()
                    result.success(true)
                }
                "checkPermissions" -> {
                    val granted = checkTelephonyPermissions()
                    result.success(granted)
                }
                else -> {
                    result.notImplemented()
                }
            }
        }
    }

    private fun checkTelephonyPermissions(): Boolean {
        val callPhoneGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED
        val readPhoneStateGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
        return callPhoneGranted && readPhoneStateGranted
    }

    private fun requestTelephonyPermissions() {
        val permissions = mutableListOf(Manifest.permission.CALL_PHONE, Manifest.permission.READ_PHONE_STATE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            ActivityCompat.requestPermissions(this, permissions.toTypedArray(), 101)
        }
    }

    private fun makeRealPhoneCall(phoneNumber: String, simSlot: Int): Boolean {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            return false
        }
        try {
            val intent = Intent(Intent.ACTION_CALL)
            intent.data = Uri.parse("tel:$phoneNumber")
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

            // Setup dual SIM parameters (tested for Samsung/MTK devices)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                val subscriptionManager = getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
                try {
                    val activeList = subscriptionManager.activeSubscriptionInfoList
                    if (activeList != null && activeList.isNotEmpty()) {
                        val index = simSlot - 1
                        val subInfo = if (index >= 0 && index < activeList.size) {
                            activeList[index]
                        } else {
                            activeList[0]
                        }
                        intent.putExtra("simSlot", simSlot - 1)
                        intent.putExtra("com.android.phone.extra.slot", simSlot - 1)
                        intent.putExtra("phone", subInfo.subscriptionId)
                        intent.putExtra("subscription", subInfo.subscriptionId)
                        intent.putExtra("com.android.phone.dialing_slot", simSlot - 1)
                    }
                } catch (se: SecurityException) {
                    // fall back if permission not fully recognized at this code path
                }
            }
            startActivity(intent)
            return true
        } catch (e: Exception) {
            e.printStackTrace()
            return false
        }
    }
}
