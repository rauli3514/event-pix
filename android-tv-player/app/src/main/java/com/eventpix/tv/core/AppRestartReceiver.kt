package com.eventpix.tv.core

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import kotlin.system.exitProcess

class AppRestartReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.e("AppRestartReceiver", "Scheduled or emergency restart triggered. Launching MainActivity...")
        
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        }
        
        context.startActivity(launchIntent)
        
        // Kill the old process if this was triggered internally to ensure memory is cleared
        if (intent.getBooleanExtra("killProcess", false)) {
            Log.e("AppRestartReceiver", "Killing process for fresh start.")
            exitProcess(0)
        }
    }
}
