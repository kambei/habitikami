package dev.kambei.habitikami.widget

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import dev.kambei.habitikami.R

class WidgetConfigActivity : AppCompatActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Default result = cancelled (user backs out)
        setResult(RESULT_CANCELED)

        appWidgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        setContentView(R.layout.activity_widget_config)

        val etUrl = findViewById<EditText>(R.id.et_base_url)
        val etToken = findViewById<EditText>(R.id.et_api_token)
        val btnSave = findViewById<Button>(R.id.btn_save)

        // Pre-fill from existing config
        val existing = CounterWidgetProvider.getConfig(this)
        if (existing != null) {
            etUrl.setText(existing.first)
            etToken.setText(existing.second)
        }

        btnSave.setOnClickListener {
            val baseUrl = etUrl.text.toString().trim().trimEnd('/')
            val apiToken = etToken.text.toString().trim()

            if (baseUrl.isEmpty() || apiToken.isEmpty()) {
                Toast.makeText(this, "Both fields are required", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // Save config
            getSharedPreferences("habitikami_widget", MODE_PRIVATE)
                .edit()
                .putString("base_url", baseUrl)
                .putString("api_token", apiToken)
                .apply()

            // Trigger initial widget update
            val mgr = AppWidgetManager.getInstance(this)
            CounterWidgetProvider().onUpdate(this, mgr, intArrayOf(appWidgetId))

            // Return success
            setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId))
            finish()
        }
    }
}
