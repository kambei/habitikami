package dev.kambei.habitikami

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import dev.kambei.habitikami.widget.WidgetRefresher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Thin launcher that shows a cached update prompt (if any), then forwards to the TWA.
 * The actual update check runs in the background so it never blocks app startup —
 * results are shown on the *next* launch.
 */
class MainActivity : AppCompatActivity() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Check for a cached update from a previous background check
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        val cachedVersion = prefs.getString("cached_version", null)
        val cachedApkUrl = prefs.getString("cached_apk_url", null)
        val cachedHtmlUrl = prefs.getString("cached_html_url", null)
        val cachedBody = prefs.getString("cached_body", null)
        val skippedVersion = prefs.getString("skipped_version", null)

        if (cachedVersion != null && cachedVersion != skippedVersion
            && UpdateChecker.isNewer(cachedVersion, BuildConfig.VERSION_NAME)
        ) {
            showUpdateDialog(cachedVersion, cachedApkUrl, cachedHtmlUrl, cachedBody)
        } else {
            launchTwa()
        }

        // The user is about to change data in the app: refresh the home screen widgets now
        // and again shortly after, so what they tick in the TWA shows up without waiting.
        refreshWidgets()

        // Always refresh the cache in the background for next launch
        scope.launch {
            val release = UpdateChecker.checkForUpdate(BuildConfig.VERSION_NAME)
            val editor = prefs.edit()
            if (release != null) {
                editor.putString("cached_version", release.tagName)
                editor.putString("cached_apk_url", release.apkUrl)
                editor.putString("cached_html_url", release.htmlUrl)
                editor.putString("cached_body", release.body)
            } else {
                // No update or couldn't reach GitHub — clear cache
                editor.remove("cached_version")
                editor.remove("cached_apk_url")
                editor.remove("cached_html_url")
                editor.remove("cached_body")
            }
            editor.apply()
        }
    }

    private fun showUpdateDialog(version: String, apkUrl: String?, htmlUrl: String?, body: String?) {
        val message = buildString {
            append(getString(R.string.update_message, version, BuildConfig.VERSION_NAME))
            if (!body.isNullOrBlank()) {
                append("\n\n").append(getString(R.string.update_changelog_title)).append("\n").append(body)
            }
            if (apkUrl != null) append("\n\n").append(getString(R.string.update_download_note))
        }
        AlertDialog.Builder(this, R.style.Theme_Habitikami_Dialog)
            .setTitle(R.string.update_title)
            .setMessage(message)
            .setPositiveButton(R.string.update_now) { _, _ ->
                // Prefer the APK itself so the download starts right away; fall back to the release page
                val url = apkUrl ?: htmlUrl
                if (url != null) {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                }
                finish()
            }
            .setNegativeButton(R.string.update_later) { _, _ ->
                launchTwa()
            }
            .setNeutralButton(R.string.update_skip) { _, _ ->
                getSharedPreferences(PREFS, MODE_PRIVATE)
                    .edit()
                    .putString("skipped_version", version)
                    .apply()
                launchTwa()
            }
            .setCancelable(false)
            .show()
    }

    /** Refreshes every widget now and once more after a short delay (the app may have just been used). */
    private fun refreshWidgets() {
        val app = applicationContext
        runCatching { WidgetRefresher.refreshAll(app) }
        scope.launch {
            delay(WIDGET_REFRESH_DELAY_MS)
            runCatching { WidgetRefresher.refreshAll(app) }
        }
    }

    private fun launchTwa() {
        val deepLink = this@MainActivity.intent?.data
        val baseUrl = deepLink?.toString() ?: BuildConfig.PWA_URL
        val separator = if ("?" in baseUrl) "&" else "?"
        val urlWithVersion = "${baseUrl}${separator}android_version=${BuildConfig.VERSION_NAME}"

        val twaIntent = Intent().apply {
            setClassName(
                this@MainActivity,
                "com.google.androidbrowserhelper.trusted.LauncherActivity"
            )
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            data = Uri.parse(urlWithVersion)
        }
        startActivity(twaIntent)
        finish()
    }

    companion object {
        private const val PREFS = "habitikami_updates"
        private const val WIDGET_REFRESH_DELAY_MS = 45_000L
    }
}
