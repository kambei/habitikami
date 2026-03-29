package dev.kambei.habitikami.widget

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import dev.kambei.habitikami.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MiniHeatmapConfigActivity : AppCompatActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var selectedHabit: String? = null

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

        // Reuse the same layout as habit stats config
        setContentView(R.layout.activity_habit_stats_config)

        val etUrl = findViewById<EditText>(R.id.et_base_url)
        val etToken = findViewById<EditText>(R.id.et_api_token)
        val btnLoad = findViewById<Button>(R.id.btn_load_habits)
        val habitsScroll = findViewById<ScrollView>(R.id.habits_scroll)
        val radioGroup = findViewById<RadioGroup>(R.id.radio_group_habits)
        val progressBar = findViewById<ProgressBar>(R.id.progress_bar)
        val btnSave = findViewById<Button>(R.id.btn_save)

        val existing = CounterWidgetProvider.getConfig(this)
        if (existing != null) {
            etUrl.setText(existing.first)
            etToken.setText(existing.second)
        }

        val savedHabit = MiniHeatmapWidgetProvider.getSelectedHabit(this, appWidgetId)

        btnLoad.setOnClickListener {
            val baseUrl = etUrl.text.toString().trim().trimEnd('/')
            val apiToken = etToken.text.toString().trim()

            if (baseUrl.isEmpty() || apiToken.isEmpty()) {
                Toast.makeText(this, "Enter URL and token first", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            getSharedPreferences("habitikami_widget", MODE_PRIVATE)
                .edit()
                .putString("base_url", baseUrl)
                .putString("api_token", apiToken)
                .apply()

            progressBar.visibility = View.VISIBLE
            btnLoad.isEnabled = false
            radioGroup.removeAllViews()

            scope.launch {
                try {
                    val export = HabitApiClient.fetchExport(baseUrl, apiToken, 14)
                    val allDays = export.weekdays + export.weekend
                    val allHabits = allDays.flatMap { it.habits.keys }.distinct().sorted()

                    withContext(Dispatchers.Main) {
                        progressBar.visibility = View.GONE
                        btnLoad.isEnabled = true

                        if (allHabits.isEmpty()) {
                            Toast.makeText(this@MiniHeatmapConfigActivity, "No habits found", Toast.LENGTH_SHORT).show()
                            return@withContext
                        }

                        habitsScroll.visibility = View.VISIBLE
                        btnSave.visibility = View.VISIBLE

                        for (habit in allHabits) {
                            val rb = RadioButton(this@MiniHeatmapConfigActivity).apply {
                                text = habit
                                setTextColor(0xFFE6E1E5.toInt())
                                textSize = 16f
                                setPadding(8, 16, 8, 16)
                                val color = export.colors[habit]
                                if (color != null) buttonTintList =
                                    android.content.res.ColorStateList.valueOf(color)
                            }
                            radioGroup.addView(rb)
                            if (habit == savedHabit) {
                                rb.isChecked = true
                                selectedHabit = habit
                            }
                        }

                        if (selectedHabit == null && radioGroup.childCount > 0) {
                            (radioGroup.getChildAt(0) as RadioButton).isChecked = true
                            selectedHabit = allHabits[0]
                        }

                        radioGroup.setOnCheckedChangeListener { group, checkedId ->
                            val rb = group.findViewById<RadioButton>(checkedId)
                            selectedHabit = rb?.text?.toString()
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        progressBar.visibility = View.GONE
                        btnLoad.isEnabled = true
                        Toast.makeText(this@MiniHeatmapConfigActivity, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        btnSave.setOnClickListener {
            val habit = selectedHabit
            if (habit == null) {
                Toast.makeText(this, "Select a habit", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            MiniHeatmapWidgetProvider.saveSelectedHabit(this, appWidgetId, habit)

            val mgr = AppWidgetManager.getInstance(this)
            MiniHeatmapWidgetProvider().onUpdate(this, mgr, intArrayOf(appWidgetId))

            setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId))
            finish()
        }

        if (existing != null) {
            btnLoad.performClick()
        }
    }
}
