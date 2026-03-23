package dev.kambei.habitikami.widget

import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

data class CounterValues(
    val smoke: Int = 0,
    val smoked: Int = 0,
    val coffee: Int = 0,
)

object CounterApiClient {

    /** Fetch today's counter values. Runs on calling thread — call from background. */
    fun fetchTodayCounters(baseUrl: String, apiToken: String): CounterValues {
        val url = URL("$baseUrl/api/counter")
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "GET"
            conn.setRequestProperty("X-API-Token", apiToken)
            conn.connectTimeout = 10_000
            conn.readTimeout = 10_000

            if (conn.responseCode != 200) return CounterValues()

            val body = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
            val json = JSONObject(body)
            if (!json.optBoolean("success", false)) return CounterValues()

            val counters = json.getJSONObject("counters")
            return CounterValues(
                smoke = counters.optInt("smoke", 0),
                smoked = counters.optInt("smoked", 0),
                coffee = counters.optInt("coffee", 0),
            )
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
    /** Fetch counter history for a date range. Uses the dedicated /api/counter endpoint
     *  which returns properly-named fields (smoke, smoked, coffee) regardless of sheet headers. */
    fun fetchCounterHistory(baseUrl: String, apiToken: String, days: Int = 14): List<CounterEntry> {
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
            val result = mutableListOf<CounterEntry>()
            for (i in 0 until entries.length()) {
                val obj = entries.getJSONObject(i)
                result.add(CounterEntry(
                    date = obj.optString("date", ""),
                    smoke = obj.optInt("smoke", 0),
                    smoked = obj.optInt("smoked", 0),
                    coffee = obj.optInt("coffee", 0),
                ))
            }
            return result
        } finally {
            conn.disconnect()
        }
    }
}
