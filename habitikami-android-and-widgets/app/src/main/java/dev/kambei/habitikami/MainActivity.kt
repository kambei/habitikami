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
 * Thin launcher that checks for app updates on GitHub, then forwards to the TWA.
 * If an update is available (and not previously skipped), shows a dialog first.
 */
class MainActivity : AppCompatActivity() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        scope.launch {
            val release = UpdateChecker.checkForUpdate(BuildConfig.VERSION_NAME)

            if (release != null && !wasSkipped(release.tagName)) {
                showUpdateDialog(release)
            } else {
                launchTwa()
            }
        }
    }

    private fun showUpdateDialog(release: UpdateChecker.Release) {
        AlertDialog.Builder(this, R.style.Theme_Habitikami_Dialog)
            .setTitle("Update Available")
            .setMessage("A new version (v${release.tagName}) is available.\nYou are on v${BuildConfig.VERSION_NAME}.")
            .setPositiveButton("Update") { _, _ ->
                // Prefer direct APK download, fallback to release page
                val url = release.apkUrl ?: release.htmlUrl
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                launchTwa()
            }
            .setNegativeButton("Later") { _, _ ->
                launchTwa()
            }
            .setNeutralButton("Skip this version") { _, _ ->
                skipVersion(release.tagName)
                launchTwa()
            }
            .setCancelable(false)
            .show()
    }

    private fun launchTwa() {
        val intent = Intent()
        intent.setClassName(this, "com.google.androidbrowserhelper.trusted.LauncherActivity")
        // Forward any deep-link data
        if (getIntent().data != null) {
            intent.data = getIntent().data
        }
        startActivity(intent)
        finish()
    }

    private fun wasSkipped(version: String): Boolean {
        val prefs = getSharedPreferences("habitikami_updates", MODE_PRIVATE)
        return prefs.getString("skipped_version", null) == version
    }

    private fun skipVersion(version: String) {
        getSharedPreferences("habitikami_updates", MODE_PRIVATE)
            .edit()
            .putString("skipped_version", version)
            .apply()
    }
}
