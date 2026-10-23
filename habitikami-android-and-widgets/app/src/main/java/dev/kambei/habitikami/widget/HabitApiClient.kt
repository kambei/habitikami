package dev.kambei.habitikami.widget

import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

data class DayEntry(
    val date: String,
    val habits: Map<String, Boolean>,   // habit name → checked (TRUE)
    val half: Set<String> = emptySet(),    // habits marked HALF (count as done for streaks)
    val skipped: Set<String> = emptySet(), // habits marked SKIP (neutral for streaks)
)

data class ExportData(
    val weekdays: List<DayEntry>,
    val weekend: List<DayEntry>,
    val counters: List<DynamicCounterEntry>,
    val colors: Map<String, Int> = emptyMap(),   // habit name → Android color int
)

/** One habit of today's row as GET /api/today returns it. */
data class TodayHabit(
    val name: String,
    val value: String?,      // raw cell: TRUE/FALSE/HALF/SKIP, a number, or null when empty
    val done: Boolean,
    val type: String,        // "check" | "number"
    val slot: String,        // any | morning | afternoon | evening
    val time: String?,
    val color: Int?,
)

data class TodayData(
    val sheet: String,
    val date: String,        // DD/MM/YYYY
    val found: Boolean,      // false when the sheet has no row for the date
    val habits: List<TodayHabit>,
) {
    val doneCount: Int get() = habits.count { it.done }

    fun toJson(): String {
        val arr = org.json.JSONArray()
        for (h in habits) {
            arr.put(
                JSONObject().put("name", h.name).put("value", h.value ?: JSONObject.NULL).put("done", h.done)
                    .put("type", h.type).put("slot", h.slot).put("time", h.time ?: JSONObject.NULL).put("color", h.color ?: JSONObject.NULL)
            )
        }
        return JSONObject().put("sheet", sheet).put("date", date).put("found", found).put("habits", arr).toString()
    }

    companion object {
        fun fromJson(raw: String): TodayData? = try { parseToday(JSONObject(raw)) } catch (_: Exception) { null }

        internal fun parseToday(json: JSONObject): TodayData {
            val arr = json.optJSONArray("habits") ?: org.json.JSONArray()
            val habits = (0 until arr.length()).map { i ->
                val h = arr.getJSONObject(i)
                val colorRaw = h.opt("color")
                val color: Int? = when (colorRaw) {
                    is Int -> colorRaw
                    is String -> try { android.graphics.Color.parseColor(colorRaw) } catch (_: Exception) { null }
                    else -> null
                }
                TodayHabit(
                    name = h.optString("name"),
                    value = if (h.isNull("value")) null else h.optString("value"),
                    done = h.optBoolean("done", false),
                    type = h.optString("type", "check"),
                    slot = h.optString("slot", "any"),
                    time = if (h.isNull("time")) null else h.optString("time"),
                    color = color,
                )
            }
            return TodayData(json.optString("sheet"), json.optString("date"), json.optBoolean("found", false), habits)
        }
    }
}

object HabitApiClient {

    /** Today's row (or [isoDate]'s) with meta and colours: GET /api/today. */
    fun fetchToday(baseUrl: String, apiToken: String, isoDate: String = java.time.LocalDate.now().toString()): TodayData {
        val url = URL("$baseUrl/api/today?date=$isoDate")
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "GET"
            conn.setRequestProperty("X-API-Token", apiToken)
            conn.connectTimeout = 15_000
            conn.readTimeout = 15_000
            if (conn.responseCode != 200) throw ApiException(conn.responseCode)
            val body = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
            return TodayData.parseToday(JSONObject(body))
        } finally {
            conn.disconnect()
        }
    }

    /** Writes one cell (TRUE/FALSE/HALF/SKIP or a number): POST /api/cell. */
    fun setCell(baseUrl: String, apiToken: String, isoDate: String, habit: String, value: String) {
        val url = URL("$baseUrl/api/cell")
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.setRequestProperty("X-API-Token", apiToken)
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            conn.connectTimeout = 10_000
            conn.readTimeout = 10_000
            val payload = JSONObject().put("date", isoDate).put("habit", habit).put("value", value).toString()
            conn.outputStream.use { it.write(payload.toByteArray()) }
            if (conn.responseCode != 200) throw ApiException(conn.responseCode)
        } finally {
            conn.disconnect()
        }
    }

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

            if (conn.responseCode != 200) throw ApiException(conn.responseCode)

            val body = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
            val json = JSONObject(body)

            // Goals of quantitative habits: a numeric cell is done when it reaches its goal
            val targets = parseTargets(json.optJSONObject("habitMeta"))
            val weekdays = parseDayEntries(json.optJSONArray("weekdays"), targets)
            val weekend = parseDayEntries(json.optJSONArray("weekend"), targets)
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

    /** habitMeta → habit name to goal (null = numeric without goal, absent = checkbox habit). */
    private fun parseTargets(meta: JSONObject?): Map<String, Double?> {
        if (meta == null) return emptyMap()
        val out = mutableMapOf<String, Double?>()
        val keys = meta.keys()
        while (keys.hasNext()) {
            val habit = keys.next()
            val entry = meta.optJSONObject(habit) ?: continue
            if (entry.optString("type", "check") != "number") continue
            val target = entry.optDouble("target", Double.NaN)
            out[habit] = if (target.isNaN() || target <= 0) null else target
        }
        return out
    }

    private fun parseDayEntries(arr: org.json.JSONArray?, targets: Map<String, Double?> = emptyMap()): List<DayEntry> {
        if (arr == null) return emptyList()
        val result = mutableListOf<DayEntry>()
        for (i in 0 until arr.length()) {
            val obj = arr.getJSONObject(i)
            val keys = obj.keys()
            var date = ""
            val habits = mutableMapOf<String, Boolean>()
            val half = mutableSetOf<String>()
            val skipped = mutableSetOf<String>()
            while (keys.hasNext()) {
                val key = keys.next()
                if (SKIP_COLUMNS.contains(key.lowercase())) {
                    // Use "Data" or "Date" field as the date
                    if (key.lowercase().let { it == "date" || it == "data" }) {
                        date = obj.optString(key, "")
                    }
                } else {
                    val value = obj.optString(key, "").trim()
                    // Cells are "TRUE"/"FALSE" (checkbox), "HALF", "SKIP" or a number (quantitative habit)
                    val numeric = value.replace(',', '.').toDoubleOrNull()
                    habits[key] = if (numeric != null && targets.containsKey(key)) {
                        val goal = targets[key]
                        if (goal != null) numeric >= goal else numeric > 0
                    } else {
                        value.equals("TRUE", ignoreCase = true)
                    }
                    when {
                        value.equals("HALF", ignoreCase = true) -> half.add(key)
                        value.equals("SKIP", ignoreCase = true) -> skipped.add(key)
                    }
                }
            }
            // Normalize date: DD/MM/YYYY → YYYY-MM-DD for proper sorting
            if (date.isNotEmpty()) {
                date = normalizeDate(date)
                // Only include entries that have at least one habit value
                if (habits.isNotEmpty()) {
                    result.add(DayEntry(date, habits, half, skipped))
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
