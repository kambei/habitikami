package dev.kambei.habitikami.widget

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dev.kambei.habitikami.BuildConfig
import java.security.KeyStore

/**
 * Single entry point for the widget connection settings (server URL + API key).
 *
 * The two sensitive values live in an [EncryptedSharedPreferences] file
 * ([SECURE_PREFS_NAME]) whose keyset is wrapped by a master key held in the
 * Android Keystore. Everything that is not sensitive (counter definition cache,
 * per-widget filters, ...) stays in the plain [PLAIN_PREFS_NAME] file, exposed
 * through [plainPrefs].
 *
 * On first access the legacy plaintext values (same keys in [PLAIN_PREFS_NAME],
 * written by app versions <= 5.3.2) are copied into the encrypted store and
 * removed from the plaintext file, so existing users keep their widgets working
 * without reconfiguring anything.
 *
 * If the encrypted store cannot be opened (corrupted Keystore, restored data from
 * another device, ...) it is wiped and recreated empty: the widgets fall back to
 * the "not configured" state instead of crashing.
 */
object WidgetConfigStore {

    private const val TAG = "WidgetConfigStore"

    /** Plain SharedPreferences file: non-sensitive widget data (and the legacy location of the key). */
    const val PLAIN_PREFS_NAME = "habitikami_widget"

    /** EncryptedSharedPreferences file holding base_url and api_token. */
    const val SECURE_PREFS_NAME = "habitikami_widget_secure"

    private const val KEY_BASE_URL = "base_url"
    private const val KEY_API_TOKEN = "api_token"

    /** Hosts that may be reached over plain http from debug builds (emulator / adb reverse). */
    private val DEBUG_HTTP_HOSTS = setOf("10.0.2.2", "localhost", "127.0.0.1")

    private val lock = Any()

    @Volatile
    private var securePrefs: SharedPreferences? = null

    @Volatile
    private var migrated = false

    /** Returns (baseUrl, apiToken) or null when the widget is not configured yet. */
    fun getConfig(context: Context): Pair<String, String>? {
        val prefs = secure(context) ?: return null
        val url = read(prefs, KEY_BASE_URL)?.takeIf { it.isNotBlank() } ?: return null
        val token = read(prefs, KEY_API_TOKEN)?.takeIf { it.isNotBlank() } ?: return null
        return url to token
    }

    /** Persists the connection settings in the encrypted store. */
    fun saveConfig(context: Context, baseUrl: String, apiToken: String) {
        val prefs = secure(context)
        if (prefs == null) {
            Log.e(TAG, "Encrypted store unavailable, config not saved")
            return
        }
        prefs.edit()
            .putString(KEY_BASE_URL, baseUrl.trim().trimEnd('/'))
            .putString(KEY_API_TOKEN, apiToken.trim())
            .apply()
        // Make sure no plaintext copy survives, whatever the migration state.
        removeLegacyValues(context)
    }

    /** Removes the connection settings (encrypted and any legacy plaintext copy). */
    fun clearConfig(context: Context) {
        secure(context)?.edit()?.remove(KEY_BASE_URL)?.remove(KEY_API_TOKEN)?.apply()
        removeLegacyValues(context)
    }

    /** Plain (unencrypted) SharedPreferences for non-sensitive widget data. */
    fun plainPrefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PLAIN_PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * True when [raw] is a server URL the widgets are allowed to talk to:
     * an absolute `https://` URL with a host. Debug builds also accept `http://`
     * towards the emulator host and localhost, matching the debug network security config.
     */
    fun isAllowedBaseUrl(raw: String): Boolean {
        val uri = try {
            Uri.parse(raw.trim())
        } catch (_: Exception) {
            return false
        }
        val scheme = uri.scheme?.lowercase() ?: return false
        val host = uri.host?.lowercase()?.takeIf { it.isNotEmpty() } ?: return false
        if (!uri.isHierarchical || uri.userInfo != null) return false
        return when (scheme) {
            "https" -> true
            "http" -> BuildConfig.DEBUG && host in DEBUG_HTTP_HOSTS
            else -> false
        }
    }

    // ── internals ──────────────────────────────────────────────────────────

    private fun secure(context: Context): SharedPreferences? {
        securePrefs?.let { return it }
        synchronized(lock) {
            securePrefs?.let { return it }
            val appContext = context.applicationContext
            val prefs = open(appContext) ?: return null
            securePrefs = prefs
            migrateLegacy(appContext, prefs)
            return prefs
        }
    }

    /** Reads a value, treating a decryption failure of a single entry as "absent". */
    private fun read(prefs: SharedPreferences, key: String): String? = try {
        prefs.getString(key, null)
    } catch (e: Exception) {
        Log.w(TAG, "Cannot read $key from encrypted store", e)
        null
    }

    private fun open(context: Context): SharedPreferences? {
        try {
            return create(context)
        } catch (e: Exception) {
            Log.w(TAG, "Encrypted store unreadable, recreating it empty", e)
        }
        // Recovery: drop the broken keyset file (and master key) and start over.
        try {
            context.deleteSharedPreferences(SECURE_PREFS_NAME)
        } catch (e: Exception) {
            Log.w(TAG, "Cannot delete $SECURE_PREFS_NAME", e)
        }
        try {
            KeyStore.getInstance("AndroidKeyStore").apply {
                load(null)
                if (containsAlias(MasterKey.DEFAULT_MASTER_KEY_ALIAS)) {
                    deleteEntry(MasterKey.DEFAULT_MASTER_KEY_ALIAS)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Cannot reset master key", e)
        }
        return try {
            create(context)
        } catch (e: Exception) {
            Log.e(TAG, "Encrypted store unavailable, widgets will run unconfigured", e)
            null
        }
    }

    private fun create(context: Context): SharedPreferences {
        val masterKey = MasterKey.Builder(context, MasterKey.DEFAULT_MASTER_KEY_ALIAS)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            context,
            SECURE_PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    /** One-shot copy of the plaintext legacy values into the encrypted store. */
    private fun migrateLegacy(context: Context, secure: SharedPreferences) {
        if (migrated) return
        migrated = true
        val legacy = plainPrefs(context)
        val legacyUrl = legacy.getString(KEY_BASE_URL, null)
        val legacyToken = legacy.getString(KEY_API_TOKEN, null)
        if (legacyUrl == null && legacyToken == null) return

        val alreadyConfigured = !read(secure, KEY_BASE_URL).isNullOrBlank() &&
            !read(secure, KEY_API_TOKEN).isNullOrBlank()
        if (!alreadyConfigured && !legacyUrl.isNullOrBlank() && !legacyToken.isNullOrBlank()) {
            val ok = secure.edit()
                .putString(KEY_BASE_URL, legacyUrl)
                .putString(KEY_API_TOKEN, legacyToken)
                .commit()
            if (!ok) {
                Log.e(TAG, "Legacy config migration failed, keeping plaintext values for now")
                migrated = false
                return
            }
            Log.i(TAG, "Migrated widget config to encrypted store")
        }
        removeLegacyValues(context)
    }

    private fun removeLegacyValues(context: Context) {
        val legacy = plainPrefs(context)
        if (legacy.contains(KEY_BASE_URL) || legacy.contains(KEY_API_TOKEN)) {
            legacy.edit().remove(KEY_BASE_URL).remove(KEY_API_TOKEN).commit()
        }
    }
}
