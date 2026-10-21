package dev.kambei.habitikami.widget

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import dev.kambei.habitikami.R

/**
 * Receives `web+habitikami://widget-config?url=<server>&key=<api key>` from the
 * web app ("Configure widgets on this phone" button or QR code), confirms and
 * stores the pair in the encrypted store, then refreshes every widget (A5/U6).
 */
class WidgetPairingActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val uri = intent?.data
        val url = uri?.getQueryParameter("url")?.trim()?.trimEnd('/')
        val key = uri?.getQueryParameter("key")?.trim()

        if (uri == null || uri.host != "widget-config" || url.isNullOrEmpty() || key.isNullOrEmpty()) {
            Toast.makeText(this, R.string.pairing_invalid_link, Toast.LENGTH_LONG).show()
            finish()
            return
        }
        if (!WidgetConfigStore.isAllowedBaseUrl(url)) {
            Toast.makeText(this, R.string.error_url_https_required, Toast.LENGTH_LONG).show()
            finish()
            return
        }

        val masked = if (key.length > 10) key.take(7) + "…" + key.takeLast(3) else "…"
        AlertDialog.Builder(this, R.style.Theme_Habitikami_Dialog)
            .setTitle(R.string.pairing_title)
            .setMessage(getString(R.string.pairing_message, url, masked))
            .setPositiveButton(R.string.pairing_confirm) { _, _ ->
                WidgetConfigStore.saveConfig(this, url, key)
                WidgetRefresher.refreshAll(this)
                Toast.makeText(this, R.string.pairing_done, Toast.LENGTH_LONG).show()
                finish()
            }
            .setNegativeButton(R.string.cancel) { _, _ -> finish() }
            .setOnCancelListener { finish() }
            .show()
    }
}
