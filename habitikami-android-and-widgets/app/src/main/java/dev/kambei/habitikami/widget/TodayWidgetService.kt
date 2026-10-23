package dev.kambei.habitikami.widget

import android.content.Context
import android.content.Intent
import android.graphics.Paint
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import dev.kambei.habitikami.R

/** Feeds the "Today" widget list from the cached row (TodayCache). */
class TodayWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsService.RemoteViewsFactory = TodayRemoteViewsFactory(applicationContext)
}

class TodayRemoteViewsFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {
    private var items: List<TodayHabit> = emptyList()

    override fun onCreate() { load() }
    override fun onDataSetChanged() { load() }
    override fun onDestroy() {}

    private fun load() {
        val data = TodayCache.read(context, TodayWidgetProvider.todayIso())
        items = if (data == null) emptyList() else TodayWidgetProvider.ordered(data.habits)
    }

    override fun getCount(): Int = items.size
    override fun getViewTypeCount(): Int = 1
    override fun getItemId(position: Int): Long = items.getOrNull(position)?.name?.hashCode()?.toLong() ?: position.toLong()
    override fun hasStableIds(): Boolean = true
    override fun getLoadingView(): RemoteViews? = null

    override fun getViewAt(position: Int): RemoteViews {
        val h = items[position]
        val row = RemoteViews(context.packageName, R.layout.widget_today_item)
        row.setTextViewText(R.id.tv_today_item_name, h.name)
        val meta = listOfNotNull(h.time, if (h.slot != "any") slotLabel(h.slot) else null).joinToString(" · ")
        row.setTextViewText(R.id.tv_today_item_meta, meta)
        row.setViewVisibility(R.id.tv_today_item_meta, if (meta.isEmpty()) View.GONE else View.VISIBLE)
        row.setInt(R.id.iv_today_item_dot, "setColorFilter", h.color ?: 0xFF6B7280.toInt())
        row.setTextViewText(R.id.tv_today_item_state, stateGlyph(h))
        val flags = if (h.done) Paint.STRIKE_THRU_TEXT_FLAG or Paint.ANTI_ALIAS_FLAG else Paint.ANTI_ALIAS_FLAG
        row.setInt(R.id.tv_today_item_name, "setPaintFlags", flags)

        val fillIn = Intent().apply {
            putExtra(TodayWidgetProvider.EXTRA_HABIT, h.name)
            putExtra(TodayWidgetProvider.EXTRA_VALUE, h.value ?: "")
            putExtra(TodayWidgetProvider.EXTRA_TYPE, h.type)
        }
        row.setOnClickFillInIntent(R.id.row_today_item, fillIn)
        return row
    }

    private fun stateGlyph(h: TodayHabit): String {
        val v = h.value?.trim()?.uppercase()
        return when {
            h.type == "number" -> if (h.value.isNullOrEmpty()) "0" else h.value
            v == "TRUE" -> "✅"
            v == "HALF" -> "◐"
            v == "SKIP" -> "⏭"
            else -> "⬜"
        }
    }

    private fun slotLabel(slot: String): String = when (slot) {
        "morning" -> context.getString(R.string.widget_slot_morning)
        "afternoon" -> context.getString(R.string.widget_slot_afternoon)
        "evening" -> context.getString(R.string.widget_slot_evening)
        else -> ""
    }
}
