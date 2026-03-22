package dev.kambei.habitikami.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import dev.kambei.habitikami.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class StatsWidgetConfigActivity : AppCompatActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val habitCheckboxes = mutableListOf<Pair<String, CheckBox>>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)

        appWidgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        setContentView(R.layout.activity_stats_config)

        val etUrl = findViewById<EditText>(R.id.et_base_url)
        val etToken = findViewById<EditText>(R.id.et_api_token)
        val btnLoad = findViewById<Button>(R.id.btn_load_habits)
        val habitsContainer = findViewById<LinearLayout>(R.id.habits_container)
        val habitsScroll = findViewById<ScrollView>(R.id.habits_scroll)
        val progressBar = findViewById<ProgressBar>(R.id.progress_bar)
        val btnSave = findViewById<Button>(R.id.btn_save)

        // Pre-fill from existing counter widget config
        val existing = CounterWidgetProvider.getConfig(this)
        if (existing != null) {
            etUrl.setText(existing.first)
            etToken.setText(existing.second)
        }

        // Load previously selected habits for this widget
        val savedHabits = getSelectedHabits(this, appWidgetId)

        btnLoad.setOnClickListener {
            val baseUrl = etUrl.text.toString().trim().trimEnd('/')
            val apiToken = etToken.text.toString().trim()

            if (baseUrl.isEmpty() || apiToken.isEmpty()) {
                Toast.makeText(this, "Enter URL and token first", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // Also save config for counter widget to reuse
            getSharedPreferences("habitikami_widget", MODE_PRIVATE)
                .edit()
                .putString("base_url", baseUrl)
                .putString("api_token", apiToken)
                .apply()

            progressBar.visibility = android.view.View.VISIBLE
            btnLoad.isEnabled = false
            habitsContainer.removeAllViews()
            habitCheckboxes.clear()

            scope.launch {
                try {
                    val export = HabitApiClient.fetchExport(baseUrl, apiToken, 30)
                    val allDays = export.weekdays + export.weekend
                    val allHabits = allDays.flatMap { it.habits.keys }.distinct().sorted()

                    withContext(Dispatchers.Main) {
                        progressBar.visibility = android.view.View.GONE
                        btnLoad.isEnabled = true

                        if (allHabits.isEmpty()) {
                            Toast.makeText(this@StatsWidgetConfigActivity, "No habits found", Toast.LENGTH_SHORT).show()
                            return@withContext
                        }

                        habitsScroll.visibility = android.view.View.VISIBLE
                        btnSave.visibility = android.view.View.VISIBLE

                        // Select all / none buttons
                        val btnRow = LinearLayout(this@StatsWidgetConfigActivity).apply {
                            orientation = LinearLayout.HORIZONTAL
                            setPadding(0, 0, 0, 16)
                        }

                        val btnAll = Button(this@StatsWidgetConfigActivity).apply {
                            text = "Select All"
                            textSize = 12f
                            setOnClickListener {
                                habitCheckboxes.forEach { it.second.isChecked = true }
                            }
                        }
                        val btnNone = Button(this@StatsWidgetConfigActivity).apply {
                            text = "Select None"
                            textSize = 12f
                            setOnClickListener {
                                habitCheckboxes.forEach { it.second.isChecked = false }
                            }
                        }
                        btnRow.addView(btnAll, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                        btnRow.addView(btnNone, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                        habitsContainer.addView(btnRow)

                        // Create a checkbox for each habit
                        for (habit in allHabits) {
                            val cb = CheckBox(this@StatsWidgetConfigActivity).apply {
                                text = habit
                                setTextColor(0xFFE0E0E0.toInt())
                                textSize = 16f
                                // Check by default if no saved selection, or if it was previously selected
                                isChecked = savedHabits.isEmpty() || savedHabits.contains(habit)
                                setPadding(8, 12, 8, 12)
                            }
                            habitCheckboxes.add(habit to cb)
                            habitsContainer.addView(cb)
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        progressBar.visibility = android.view.View.GONE
                        btnLoad.isEnabled = true
                        Toast.makeText(this@StatsWidgetConfigActivity, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        btnSave.setOnClickListener {
            val selected = habitCheckboxes.filter { it.second.isChecked }.map { it.first }

            if (selected.isEmpty()) {
                Toast.makeText(this, "Select at least one habit", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // Save selected habits for this widget
            saveSelectedHabits(this, appWidgetId, selected)

            // Trigger widget update
            val mgr = AppWidgetManager.getInstance(this)
            StatsWidgetProvider().onUpdate(this, mgr, intArrayOf(appWidgetId))

            setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId))
            finish()
        }

        // Auto-load if config exists
        if (existing != null) {
            btnLoad.performClick()
        }
    }

    companion object {
        private const val PREFS_NAME = "habitikami_stats_widget"

        fun saveSelectedHabits(context: Context, widgetId: Int, habits: List<String>) {
            context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putStringSet("habits_$widgetId", habits.toSet())
                .apply()
        }

        fun getSelectedHabits(context: Context, widgetId: Int): Set<String> {
            return context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .getStringSet("habits_$widgetId", emptySet()) ?: emptySet()
        }

        /** Get selected habits for any stats widget (uses first widget's selection as default). */
        fun getSelectedHabitsForWidget(context: Context, widgetId: Int): Set<String> {
            return getSelectedHabits(context, widgetId)
        }
    }
}
