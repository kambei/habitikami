package dev.kambei.habitikami.widget

import android.content.Context

/** Refreshes every home screen widget (after a configuration change or when the app is used). */
object WidgetRefresher {
    fun refreshAll(context: Context) {
        CounterWidgetProvider.refreshAll(context)
        CounterChartWidgetProvider.refreshAll(context)
        ChecklistWidgetProvider.refreshAll(context)
        WeeklySummaryWidgetProvider.refreshAll(context)
        StreakFireWidgetProvider.refreshAll(context)
        WorstHabitWidgetProvider.refreshAll(context)
        HabitStatsWidgetProvider.refreshAll(context)
        MiniHeatmapWidgetProvider.refreshAll(context)
        StatsWidgetProvider.refreshAll(context)
        TodayWidgetProvider.refreshAll(context)
    }
}
