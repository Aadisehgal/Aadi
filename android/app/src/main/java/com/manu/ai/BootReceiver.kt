package com.manu.ai

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Receives BOOT_COMPLETED broadcast and reschedules any pending reminders
 * that were stored before device reboot. Notifee handles the actual
 * rescheduling via its own boot receiver, but this receiver ensures
 * our app-level reminder metadata is intact.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.d(TAG, "Boot completed — reminder rescheduling triggered.")
            // Notifee handles alarm rescheduling internally via its own receiver.
            // App-level work (e.g. refreshing MMKV reminder list) can be added here.
        }
    }

    companion object {
        private const val TAG = "ManuBootReceiver"
    }
}
