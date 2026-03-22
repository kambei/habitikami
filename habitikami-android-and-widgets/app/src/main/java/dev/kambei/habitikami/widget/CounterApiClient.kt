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
}
