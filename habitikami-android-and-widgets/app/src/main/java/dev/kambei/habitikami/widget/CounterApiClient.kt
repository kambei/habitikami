package dev.kambei.habitikami.widget

import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

/** A single counter/temptation action definition from the server. */
data class CounterDefinition(
    val id: String,            // e.g. "smoke", "smoked", "coffee"
    val label: String,         // e.g. "Resisted", "Smoked", "Coffee"
    val color: String,         // hex e.g. "#10b981"
    val type: String,          // "positive", "negative", "neutral", etc.
    val categoryId: String = "",    // e.g. "Temptations", "Snacking"
    val categoryLabel: String = "", // e.g. "Smoking", "Snacking"
)

object CounterApiClient {

    /** Fetch temptation/counter definitions from /api/user/preferences.
     *  Returns the list of counter actions configured on the server. */
    fun fetchCounterDefinitions(baseUrl: String, apiToken: String): List<CounterDefinition> {
        val url = URL("$baseUrl/api/user/preferences")
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "GET"
            conn.setRequestProperty("X-API-Token", apiToken)
            conn.connectTimeout = 10_000
            conn.readTimeout = 10_000

            if (conn.responseCode != 200) return emptyList()

            val body = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
            val json = JSONObject(body)
            val temptations = json.optJSONArray("temptations") ?: return emptyList()

            val result = mutableListOf<CounterDefinition>()
            for (i in 0 until temptations.length()) {
                val category = temptations.getJSONObject(i)
                val catId = category.optString("id", "")
                val catLabel = category.optString("label", "")
                val actions = category.optJSONArray("actions") ?: continue
                for (j in 0 until actions.length()) {
                    val action = actions.getJSONObject(j)
                    result.add(CounterDefinition(
                        id = action.optString("id", ""),
                        label = action.optString("label", ""),
                        color = action.optString("color", "#888888"),
                        type = action.optString("type", "neutral"),
                        categoryId = catId,
                        categoryLabel = catLabel,
                    ))
                }
            }
            return result
        } finally {
            conn.disconnect()
        }
    }

    /** Fetch today's counter values as a dynamic map: counterId -> value. */
    fun fetchTodayCounters(baseUrl: String, apiToken: String): Map<String, Int> {
        val url = URL("$baseUrl/api/counter")
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "GET"
            conn.setRequestProperty("X-API-Token", apiToken)
            conn.connectTimeout = 10_000
            conn.readTimeout = 10_000

            if (conn.responseCode != 200) return emptyMap()

            val body = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
            val json = JSONObject(body)
            if (!json.optBoolean("success", false)) return emptyMap()

            val counters = json.getJSONObject("counters")
            val result = mutableMapOf<String, Int>()
            val keys = counters.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                result[key] = counters.optInt(key, 0)
            }
            return result
        } finally {
            conn.disconnect()
        }
    }

    /** Increment a counter and return the new value. Runs on calling thread. */
    fun incrementCounter(baseUrl: String, apiToken: String, counter: String): Int {
        val url = URL("$baseUrl/api/counter/increment")
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.setRequestProperty("X-API-Token", apiToken)
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            conn.connectTimeout = 10_000
            conn.readTimeout = 10_000

            val payload = JSONObject().put("counter", counter).toString()
            conn.outputStream.use { it.write(payload.toByteArray()) }

            if (conn.responseCode != 200) return -1

            val body = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
            val json = JSONObject(body)
            return json.optInt("newValue", -1)
        } finally {
            conn.disconnect()
        }
    }

    /** Fetch counter history for a date range. Returns list of dynamic entries. */
    fun fetchCounterHistory(
        baseUrl: String,
        apiToken: String,
        days: Int = 14,
    ): List<DynamicCounterEntry> {
        val newest = java.time.LocalDate.now().toString()
        val oldest = java.time.LocalDate.now().minusDays(days.toLong()).toString()
        val url = URL("$baseUrl/api/counter?oldest=$oldest&newest=$newest")
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "GET"
            conn.setRequestProperty("X-API-Token", apiToken)
            conn.connectTimeout = 10_000
            conn.readTimeout = 10_000

            if (conn.responseCode != 200) return emptyList()

            val body = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
            val json = JSONObject(body)
            if (!json.optBoolean("success", false)) return emptyList()

            val entries = json.optJSONArray("entries") ?: return emptyList()
            val result = mutableListOf<DynamicCounterEntry>()
            for (i in 0 until entries.length()) {
                val obj = entries.getJSONObject(i)
                val date = obj.optString("date", "")
                val values = mutableMapOf<String, Int>()
                val keys = obj.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    if (key != "date") {
                        values[key] = obj.optInt(key, 0)
                    }
                }
                result.add(DynamicCounterEntry(date = date, values = values))
            }
            return result
        } finally {
            conn.disconnect()
        }
    }
}

/** A single day's counter values, with dynamic keys. */
data class DynamicCounterEntry(
    val date: String,
    val values: Map<String, Int>,  // counterId -> value
)
