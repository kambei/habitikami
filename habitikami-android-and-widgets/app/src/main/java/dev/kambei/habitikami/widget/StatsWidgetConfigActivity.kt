package dev.kambei.habitikami.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.ImageButton
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
import org.json.JSONArray

class StatsWidgetConfigActivity : AppCompatActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    // Each entry: habit name, checkbox, and the row layout (for reordering)
    private val habitRows = mutableListOf<HabitRow>()

    private data class HabitRow(val name: String, val checkbox: CheckBox, val row: LinearLayout)

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

        // Load previously saved order and selection for this widget
        val savedOrder = getOrderedHabits(this, appWidgetId)
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
            habitRows.clear()

            scope.launch {
                try {
                    val export = HabitApiClient.fetchExport(baseUrl, apiToken, 30)
                    val allDays = export.weekdays + export.weekend
                    val allHabitsAlpha = allDays.flatMap { it.habits.keys }.distinct().sorted()

                    // Use saved order if available, appending any new habits at the end
                    val orderedHabits = if (savedOrder.isNotEmpty()) {
                        val ordered = savedOrder.filter { it in allHabitsAlpha }.toMutableList()
                        val newHabits = allHabitsAlpha.filter { it !in ordered }
                        ordered + newHabits
                    } else {
                        allHabitsAlpha
                    }

                    withContext(Dispatchers.Main) {
                        progressBar.visibility = android.view.View.GONE
                        btnLoad.isEnabled = true

                        if (orderedHabits.isEmpty()) {
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
                                habitRows.forEach { it.checkbox.isChecked = true }
                            }
                        }
                        val btnNone = Button(this@StatsWidgetConfigActivity).apply {
                            text = "Select None"
                            textSize = 12f
                            setOnClickListener {
                                habitRows.forEach { it.checkbox.isChecked = false }
                            }
                        }
                        btnRow.addView(btnAll, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                        btnRow.addView(btnNone, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                        habitsContainer.addView(btnRow)

                        // Hint text
                        val hint = TextView(this@StatsWidgetConfigActivity).apply {
                            text = "Use arrows to reorder habits in the heatmap"
                            setTextColor(0x99FFFFFF.toInt())
                            textSize = 12f
                            setPadding(4, 0, 4, 12)
                        }
                        habitsContainer.addView(hint)

                        // Create a row for each habit: [checkbox] [▲] [▼]
                        for (habit in orderedHabits) {
                            addHabitRow(habitsContainer, habit, savedHabits)
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
            val selected = habitRows.filter { it.checkbox.isChecked }.map { it.name }
            val allOrdered = habitRows.map { it.name }

            if (selected.isEmpty()) {
                Toast.makeText(this, "Select at least one habit", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // Save selected habits and their order
            saveSelectedHabits(this, appWidgetId, selected)
            saveHabitOrder(this, appWidgetId, allOrdered)

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

    private fun addHabitRow(container: LinearLayout, habit: String, savedHabits: Set<String>) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 4, 0, 4)
        }

        val cb = CheckBox(this).apply {
            text = habit
            setTextColor(0xFFE0E0E0.toInt())
            textSize = 16f
            isChecked = savedHabits.isEmpty() || savedHabits.contains(habit)
            setPadding(8, 8, 8, 8)
        }
        row.addView(cb, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))

        val btnUp = ImageButton(this).apply {
            setImageResource(android.R.drawable.arrow_up_float)
            setBackgroundColor(0x00000000)
            contentDescription = "Move up"
            setPadding(16, 8, 16, 8)
            setOnClickListener { moveHabit(container, habit, -1) }
        }
        row.addView(btnUp, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        val btnDown = ImageButton(this).apply {
            setImageResource(android.R.drawable.arrow_down_float)
            setBackgroundColor(0x00000000)
            contentDescription = "Move down"
            setPadding(16, 8, 16, 8)
            setOnClickListener { moveHabit(container, habit, 1) }
        }
        row.addView(btnDown, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        habitRows.add(HabitRow(habit, cb, row))
        container.addView(row)
    }

    private fun moveHabit(container: LinearLayout, habit: String, direction: Int) {
        val idx = habitRows.indexOfFirst { it.name == habit }
        if (idx < 0) return
        val newIdx = idx + direction
        if (newIdx < 0 || newIdx >= habitRows.size) return

        // Swap in the list
        val item = habitRows.removeAt(idx)
        habitRows.add(newIdx, item)

        // Rebuild the container views (keep the first 2 children: button row + hint)
        val fixedChildren = 2
        for (i in habitRows.indices) {
            container.removeView(habitRows[i].row)
        }
        for (i in habitRows.indices) {
            container.addView(habitRows[i].row, fixedChildren + i)
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

        fun saveHabitOrder(context: Context, widgetId: Int, habits: List<String>) {
            val json = JSONArray(habits).toString()
            context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putString("order_$widgetId", json)
                .apply()
        }

        fun getSelectedHabits(context: Context, widgetId: Int): Set<String> {
            return context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .getStringSet("habits_$widgetId", emptySet()) ?: emptySet()
        }

        fun getOrderedHabits(context: Context, widgetId: Int): List<String> {
            val json = context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .getString("order_$widgetId", null) ?: return emptyList()
            return try {
                val arr = JSONArray(json)
                (0 until arr.length()).map { arr.getString(it) }
            } catch (_: Exception) {
                emptyList()
            }
        }

        /** Get selected habits for any stats widget (uses first widget's selection as default). */
        fun getSelectedHabitsForWidget(context: Context, widgetId: Int): Set<String> {
            return getSelectedHabits(context, widgetId)
        }
    }
}
