package dev.kambei.habitikami

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
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
        val skippedVersion = prefs.getString("skipped_version", null)

        if (cachedVersion != null && cachedVersion != skippedVersion
            && UpdateChecker.isNewer(cachedVersion, BuildConfig.VERSION_NAME)
        ) {
            showUpdateDialog(cachedVersion, cachedApkUrl, cachedHtmlUrl)
        } else {
            launchTwa()
        }

        // Always refresh the cache in the background for next launch
        scope.launch {
            val release = UpdateChecker.checkForUpdate(BuildConfig.VERSION_NAME)
            val editor = prefs.edit()
            if (release != null) {
                editor.putString("cached_version", release.tagName)
                editor.putString("cached_apk_url", release.apkUrl)
                editor.putString("cached_html_url", release.htmlUrl)
            } else {
                // No update or couldn't reach GitHub — clear cache
                editor.remove("cached_version")
                editor.remove("cached_apk_url")
                editor.remove("cached_html_url")
            }
            editor.apply()
        }
    }

    private fun showUpdateDialog(version: String, apkUrl: String?, htmlUrl: String?) {
        AlertDialog.Builder(this, R.style.Theme_Habitikami_Dialog)
            .setTitle("Update Available")
            .setMessage("A new version (v$version) is available.\nYou are on v${BuildConfig.VERSION_NAME}.")
            .setPositiveButton("Update") { _, _ ->
                // Open release page so user can download — don't launch TWA
                val url = htmlUrl ?: apkUrl
                if (url != null) {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                }
                finish()
            }
            .setNegativeButton("Later") { _, _ ->
                launchTwa()
            }
            .setNeutralButton("Skip this version") { _, _ ->
                getSharedPreferences(PREFS, MODE_PRIVATE)
                    .edit()
                    .putString("skipped_version", version)
                    .apply()
                launchTwa()
            }
            .setCancelable(false)
            .show()
    }

    private fun launchTwa() {
        val twaIntent = Intent().apply {
            setClassName(
                this@MainActivity,
                "com.google.androidbrowserhelper.trusted.LauncherActivity"
            )
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            // Forward any deep-link
            this@MainActivity.intent?.data?.let { data = it }
        }
        startActivity(twaIntent)
        finish()
    }

    companion object {
        private const val PREFS = "habitikami_updates"
    }
}
