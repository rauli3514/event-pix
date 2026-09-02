package com.eventpix.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class BootCompletedReceiver extends BroadcastReceiver {
    private static final String TAG = "BootCompletedReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.d(TAG, "Boot completed event received, launching MainActivity...");
            Intent activityIntent = new Intent(context, MainActivity.class);
            activityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activityIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            context.startActivity(activityIntent);
        }
    }
}
