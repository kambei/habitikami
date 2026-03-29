package dev.kambei.habitikami.widget

import android.annotation.SuppressLint
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
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
    private lateinit var adapter: HabitAdapter
    private var itemTouchHelper: ItemTouchHelper? = null

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
        val recyclerView = findViewById<RecyclerView>(R.id.habits_recycler)
        val btnRow = findViewById<LinearLayout>(R.id.btn_select_row)
        val hintText = findViewById<TextView>(R.id.tv_reorder_hint)
        val progressBar = findViewById<ProgressBar>(R.id.progress_bar)
        val btnSave = findViewById<Button>(R.id.btn_save)

        adapter = HabitAdapter { viewHolder ->
            itemTouchHelper?.startDrag(viewHolder)
        }

        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter

        val touchCallback = object : ItemTouchHelper.SimpleCallback(
            ItemTouchHelper.UP or ItemTouchHelper.DOWN, 0
        ) {
            override fun onMove(
                recyclerView: RecyclerView,
                viewHolder: RecyclerView.ViewHolder,
                target: RecyclerView.ViewHolder
            ): Boolean {
                val from = viewHolder.bindingAdapterPosition
                val to = target.bindingAdapterPosition
                adapter.moveItem(from, to)
                return true
            }

            override fun onSwiped(viewHolder: RecyclerView.ViewHolder, direction: Int) {}

            override fun onSelectedChanged(viewHolder: RecyclerView.ViewHolder?, actionState: Int) {
                super.onSelectedChanged(viewHolder, actionState)
                if (actionState == ItemTouchHelper.ACTION_STATE_DRAG) {
                    viewHolder?.itemView?.alpha = 0.85f
                    viewHolder?.itemView?.scaleX = 1.03f
                    viewHolder?.itemView?.scaleY = 1.03f
                }
            }

            override fun clearView(recyclerView: RecyclerView, viewHolder: RecyclerView.ViewHolder) {
                super.clearView(recyclerView, viewHolder)
                viewHolder.itemView.alpha = 1.0f
                viewHolder.itemView.scaleX = 1.0f
                viewHolder.itemView.scaleY = 1.0f
            }

            override fun onChildDraw(
                c: Canvas, recyclerView: RecyclerView,
                viewHolder: RecyclerView.ViewHolder,
                dX: Float, dY: Float,
                actionState: Int, isCurrentlyActive: Boolean
            ) {
                super.onChildDraw(c, recyclerView, viewHolder, dX, dY, actionState, isCurrentlyActive)
                if (isCurrentlyActive) {
                    viewHolder.itemView.elevation = 8f
                }
            }
        }

        itemTouchHelper = ItemTouchHelper(touchCallback)
        itemTouchHelper!!.attachToRecyclerView(recyclerView)

        // Pre-fill from existing counter widget config
        val existing = CounterWidgetProvider.getConfig(this)
        if (existing != null) {
            etUrl.setText(existing.first)
            etToken.setText(existing.second)
        }

        // Load previously saved order and selection for this widget
        val savedOrder = getOrderedHabits(this, appWidgetId)
        val savedHabits = getSelectedHabits(this, appWidgetId)

        findViewById<Button>(R.id.btn_select_all).setOnClickListener {
            adapter.setAllChecked(true)
        }
        findViewById<Button>(R.id.btn_select_none).setOnClickListener {
            adapter.setAllChecked(false)
        }

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

            progressBar.visibility = View.VISIBLE
            btnLoad.isEnabled = false

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

                    val items = orderedHabits.map { habit ->
                        HabitItem(habit, savedHabits.isEmpty() || habit in savedHabits)
                    }

                    withContext(Dispatchers.Main) {
                        progressBar.visibility = View.GONE
                        btnLoad.isEnabled = true

                        if (items.isEmpty()) {
                            Toast.makeText(this@StatsWidgetConfigActivity, "No habits found", Toast.LENGTH_SHORT).show()
                            return@withContext
                        }

                        adapter.setItems(items)
                        recyclerView.visibility = View.VISIBLE
                        btnRow.visibility = View.VISIBLE
                        hintText.visibility = View.VISIBLE
                        btnSave.visibility = View.VISIBLE
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        progressBar.visibility = View.GONE
                        btnLoad.isEnabled = true
                        Toast.makeText(this@StatsWidgetConfigActivity, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        btnSave.setOnClickListener {
            val items = adapter.getItems()
            val selected = items.filter { it.checked }.map { it.name }
            val allOrdered = items.map { it.name }

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

    // ── Data class ──

    data class HabitItem(val name: String, var checked: Boolean)

    // ── RecyclerView Adapter ──

    class HabitAdapter(
        private val onDragStart: (RecyclerView.ViewHolder) -> Unit
    ) : RecyclerView.Adapter<HabitAdapter.ViewHolder>() {

        private val items = mutableListOf<HabitItem>()

        fun setItems(newItems: List<HabitItem>) {
            items.clear()
            items.addAll(newItems)
            @SuppressLint("NotifyDataSetChanged")
            notifyDataSetChanged()
        }

        fun getItems(): List<HabitItem> = items.toList()

        fun moveItem(from: Int, to: Int) {
            val item = items.removeAt(from)
            items.add(to, item)
            notifyItemMoved(from, to)
        }

        fun setAllChecked(checked: Boolean) {
            items.forEach { it.checked = checked }
            @SuppressLint("NotifyDataSetChanged")
            notifyDataSetChanged()
        }

        @SuppressLint("ClickableViewAccessibility")
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val row = LinearLayout(parent.context).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = RecyclerView.LayoutParams(
                    RecyclerView.LayoutParams.MATCH_PARENT,
                    RecyclerView.LayoutParams.WRAP_CONTENT
                ).apply {
                    val px = (4 * parent.context.resources.displayMetrics.density).toInt()
                    setMargins(0, px, 0, px)
                }
                setBackgroundColor(0xFF252430.toInt())
                setPadding(
                    (4 * parent.context.resources.displayMetrics.density).toInt(),
                    (10 * parent.context.resources.displayMetrics.density).toInt(),
                    (12 * parent.context.resources.displayMetrics.density).toInt(),
                    (10 * parent.context.resources.displayMetrics.density).toInt()
                )
                elevation = 2f
            }

            val cb = CheckBox(parent.context).apply {
                setTextColor(0xFFE6E1E5.toInt())
                textSize = 16f
                setPadding(
                    (8 * parent.context.resources.displayMetrics.density).toInt(), 0,
                    (8 * parent.context.resources.displayMetrics.density).toInt(), 0
                )
            }
            row.addView(cb, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))

            // Drag handle: ≡ icon
            val handle = ImageView(parent.context).apply {
                setImageResource(android.R.drawable.ic_menu_sort_by_size)
                setColorFilter(0xFF888899.toInt())
                contentDescription = "Drag to reorder"
                val size = (32 * parent.context.resources.displayMetrics.density).toInt()
                setPadding(
                    (8 * parent.context.resources.displayMetrics.density).toInt(), 0,
                    0, 0
                )
            }
            row.addView(handle, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = android.view.Gravity.CENTER_VERTICAL
            })

            val holder = ViewHolder(row, cb, handle)

            handle.setOnTouchListener { _, event ->
                if (event.actionMasked == MotionEvent.ACTION_DOWN) {
                    onDragStart(holder)
                }
                false
            }

            return holder
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            holder.checkbox.text = item.name
            holder.checkbox.setOnCheckedChangeListener(null)
            holder.checkbox.isChecked = item.checked
            holder.checkbox.setOnCheckedChangeListener { _, isChecked ->
                val pos = holder.bindingAdapterPosition
                if (pos != RecyclerView.NO_POSITION) {
                    items[pos].checked = isChecked
                }
            }
        }

        override fun getItemCount() = items.size

        class ViewHolder(
            view: View,
            val checkbox: CheckBox,
            val dragHandle: ImageView
        ) : RecyclerView.ViewHolder(view)
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
