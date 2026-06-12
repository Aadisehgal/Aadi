package com.manu.ai

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log

/**
 * Foreground service stub that keeps the app alive long enough to
 * deliver reminder notifications via Notifee when the device is idle.
 * Notifee registers its own headless task; this service satisfies the
 * AndroidManifest <service> declaration required by Android 14+.
 */
class ReminderService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "ReminderService started")
        stopSelf()
        return START_NOT_STICKY
    }

    companion object {
        private const val TAG = "ManuReminderService"
    }
}
