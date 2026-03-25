package dev.kambei.habitikami.widget

import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

data class DayEntry(
    val date: String,
    val habits: Map<String, Boolean>,   // habit name → completed
)

data class ExportData(
    val weekdays: List<DayEntry>,
    val weekend: List<DayEntry>,
    val counters: List<DynamicCounterEntry>,
    val colors: Map<String, Int> = emptyMap(),   // habit name → Android color int
)

object HabitApiClient {

    /** Fetch export data for the last [days] days. */
    fun fetchExport(baseUrl: String, apiToken: String, days: Int = 30): ExportData {
        val newest = java.time.LocalDate.now().toString()
        val oldest = java.time.LocalDate.now().minusDays(days.toLong()).toString()

        val url = URL("$baseUrl/api/export?oldest=$oldest&newest=$newest")
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "GET"
            conn.setRequestProperty("X-API-Token", apiToken)
            conn.connectTimeout = 15_000
            conn.readTimeout = 15_000

            if (conn.responseCode != 200) return ExportData(emptyList(), emptyList(), emptyList())

            val body = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
            val json = JSONObject(body)

            val weekdays = parseDayEntries(json.optJSONArray("weekdays"))
            val weekend = parseDayEntries(json.optJSONArray("weekend"))
            val counters = parseCounterEntries(json.optJSONArray("counters"))

            // Parse colors from the new API response
            val colors = parseColors(json.optJSONObject("colors"))

            return ExportData(weekdays, weekend, counters, colors)
        } finally {
            conn.disconnect()
        }
    }

    // Columns that are metadata, not habits
    private val SKIP_COLUMNS = setOf("date", "data", "giorno", "day", "jour", "fecha")

    private fun parseDayEntries(arr: org.json.JSONArray?): List<DayEntry> {
        if (arr == null) return emptyList()
        val result = mutableListOf<DayEntry>()
        for (i in 0 until arr.length()) {
            val obj = arr.getJSONObject(i)
            val keys = obj.keys()
            var date = ""
            val habits = mutableMapOf<String, Boolean>()
            while (keys.hasNext()) {
                val key = keys.next()
                if (SKIP_COLUMNS.contains(key.lowercase())) {
                    // Use "Data" or "Date" field as the date
                    if (key.lowercase().let { it == "date" || it == "data" }) {
                        date = obj.optString(key, "")
                    }
                } else {
                    val value = obj.optString(key, "").trim()
                    // Google Sheets checkboxes export as "TRUE"/"FALSE"
                    habits[key] = value.equals("TRUE", ignoreCase = true)
                }
            }
            // Normalize date: DD/MM/YYYY → YYYY-MM-DD for proper sorting
            if (date.isNotEmpty()) {
                date = normalizeDate(date)
                // Only include entries that have at least one habit value
                if (habits.isNotEmpty()) {
                    result.add(DayEntry(date, habits))
                }
            }
        }
        return result
    }

    /** Convert DD/MM/YYYY to YYYY-MM-DD, pass through if already ISO. */
    private fun normalizeDate(raw: String): String {
        val parts = raw.split("/")
        if (parts.size == 3 && parts[0].length <= 2) {
            return "${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}"
        }
        return raw // already YYYY-MM-DD or unknown format
    }

    /** Parse the colors object from the export response.
     *  Merges weekdays + weekend colors into a single map: habit name → Android color int. */
    private fun parseColors(colorsObj: JSONObject?): Map<String, Int> {
        if (colorsObj == null) return emptyMap()
        val result = mutableMapOf<String, Int>()
        for (sheetKey in listOf("weekdays", "weekend")) {
            val sheetColors = colorsObj.optJSONObject(sheetKey) ?: continue
            val keys = sheetColors.keys()
            while (keys.hasNext()) {
                val habit = keys.next()
                val hex = sheetColors.optString(habit, "")
                if (hex.isNotEmpty()) {
                    try {
                        result[habit] = android.graphics.Color.parseColor(hex)
                    } catch (_: Exception) { }
                }
            }
        }
        return result
    }

    /** Fetch only colors via the lightweight /api/colors endpoint. */
    fun fetchColors(baseUrl: String, apiToken: String): Map<String, Int> {
        val url = URL("$baseUrl/api/colors")
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "GET"
            conn.setRequestProperty("X-API-Token", apiToken)
            conn.connectTimeout = 10_000
            conn.readTimeout = 10_000

            if (conn.responseCode != 200) return emptyMap()

            val body = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
            val json = JSONObject(body)
            // /api/colors returns { weekdays: {...}, weekend: {...} } directly
            return parseColors(json)
        } finally {
            conn.disconnect()
        }
    }

    private fun parseCounterEntries(arr: org.json.JSONArray?): List<DynamicCounterEntry> {
        if (arr == null) return emptyList()
        val dateKeys = setOf("date", "data", "giorno", "day", "jour", "fecha")
        val result = mutableListOf<DynamicCounterEntry>()
        for (i in 0 until arr.length()) {
            val obj = arr.getJSONObject(i)
            val keys = obj.keys().asSequence().toList()
            val dateKey = keys.find { it.lowercase() in dateKeys } ?: continue
            val values = mutableMapOf<String, Int>()
            for (key in keys) {
                if (key.lowercase() in dateKeys) continue
                values[key] = obj.optString(key, "0").toIntOrNull() ?: 0
            }
            result.add(DynamicCounterEntry(
                date = normalizeDate(obj.optString(dateKey, "")),
                values = values,
            ))
        }
        return result
    }
}
