package dev.kambei.habitikami

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object UpdateChecker {

    data class Release(val tagName: String, val htmlUrl: String, val apkUrl: String?, val body: String = "")

    suspend fun checkForUpdate(currentVersion: String): Release? = withContext(Dispatchers.IO) {
        try {
            val url = URL("https://api.github.com/repos/kambei/habitikami/releases/latest")
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            conn.setRequestProperty("Accept", "application/vnd.github+json")

            if (conn.responseCode != 200) return@withContext null

            val body = conn.inputStream.bufferedReader().readText()
            val json = JSONObject(body)
            val tagName = json.optString("tag_name", "").removePrefix("v")
            val htmlUrl = json.optString("html_url", "")
            val notes = json.optString("body", "").trim()

            if (tagName.isEmpty() || !isNewer(tagName, currentVersion)) {
                return@withContext null
            }

            // Find APK asset URL
            val assets = json.optJSONArray("assets")
            var apkUrl: String? = null
            if (assets != null) {
                for (i in 0 until assets.length()) {
                    val asset = assets.getJSONObject(i)
                    val name = asset.optString("name", "")
                    if (name.endsWith(".apk")) {
                        apkUrl = asset.optString("browser_download_url")
                        break
                    }
                }
            }

            Release(tagName, htmlUrl, apkUrl, shortChangelog(notes))
        } catch (_: Exception) {
            null
        }
    }

    /** Keeps the first lines of the release notes, stripped of markdown noise, so they fit in a dialog. */
    fun shortChangelog(body: String, maxLines: Int = 12): String {
        val lines = body.lines()
            .map { it.trim().removePrefix("#").removePrefix("#").removePrefix("#").trim() }
            .map { it.replace(Regex("^[-*]\\s+"), "• ").replace("**", "").replace("`", "") }
            .filter { it.isNotEmpty() && !it.startsWith("Claude-Session") && !it.startsWith("Co-Authored-By") }
        val out = lines.take(maxLines).joinToString("\n")
        return if (lines.size > maxLines) "$out\n…" else out
    }

    /** Compare semver strings, return true if remote > current. */
    fun isNewer(remote: String, current: String): Boolean {
        val r = remote.split(".").mapNotNull { it.toIntOrNull() }
        val c = current.split(".").mapNotNull { it.toIntOrNull() }
        for (i in 0 until maxOf(r.size, c.size)) {
            val rv = r.getOrElse(i) { 0 }
            val cv = c.getOrElse(i) { 0 }
            if (rv > cv) return true
            if (rv < cv) return false
        }
        return false
    }
}
