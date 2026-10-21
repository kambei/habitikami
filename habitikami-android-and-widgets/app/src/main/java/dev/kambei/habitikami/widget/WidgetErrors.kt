package dev.kambei.habitikami.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import dev.kambei.habitikami.R
import java.io.IOException
import java.time.LocalTime
import java.time.format.DateTimeFormatter

/**
 * Shared widget states: "tap to configure", "wrong key: tap to reconfigure",
 * "offline, last update at HH:MM" and generic errors (issues A2/A3).
 */
object WidgetErrors {

    private val timeFmt: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm")

    /** Remembers when [tag] last rendered real data (plain prefs, not sensitive). */
    fun markUpdated(context: Context, tag: String) {
        WidgetConfigStore.plainPrefs(context).edit().putString("last_ok_$tag", LocalTime.now().format(timeFmt)).apply()
    }

    fun lastUpdated(context: Context, tag: String): String? =
        WidgetConfigStore.plainPrefs(context).getString("last_ok_$tag", null)

    fun isAuthError(e: Throwable): Boolean = e is ApiException && (e.code == 401 || e.code == 403)

    fun isOffline(e: Throwable): Boolean = e is IOException && e !is ApiException

    /** Message for a failed refresh. */
    fun statusText(context: Context, e: Throwable, tag: String): String = when {
        isAuthError(e) -> context.getString(R.string.widget_tap_to_reconfigure)
        isOffline(e) -> lastUpdated(context, tag)?.let { context.getString(R.string.widget_offline_last, it) }
            ?: context.getString(R.string.widget_offline)
        e is ApiException -> context.getString(R.string.widget_error_code, e.code)
        else -> context.getString(R.string.widget_error)
    }

    /** Opens a configuration activity for this widget. */
    fun configIntent(context: Context, widgetId: Int, activity: Class<*> = WidgetConfigActivity::class.java): PendingIntent {
        val intent = Intent(context, activity).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            data = android.net.Uri.parse("habitikami://configure/$widgetId")
        }
        return PendingIntent.getActivity(
            context, widgetId + 9000, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    /** "Tap to configure" on [statusId], opening [activity]. */
    fun applyNotConfigured(context: Context, views: RemoteViews, statusId: Int, widgetId: Int, activity: Class<*> = WidgetConfigActivity::class.java) {
        views.setTextViewText(statusId, context.getString(R.string.widget_tap_to_configure))
        views.setOnClickPendingIntent(statusId, configIntent(context, widgetId, activity))
    }

    /** Failure text on [statusId]; an invalid key makes the text open the configuration. */
    fun applyFailure(context: Context, views: RemoteViews, statusId: Int, widgetId: Int, e: Throwable, tag: String) {
        views.setTextViewText(statusId, statusText(context, e, tag))
        if (isAuthError(e)) views.setOnClickPendingIntent(statusId, configIntent(context, widgetId))
    }

    /**
     * Offline: keep whatever the widget shows and only change its status line
     * (partial update), so the last data stays visible. Returns false when the
     * error is not a connectivity problem.
     */
    fun showOfflineKeepingContent(context: Context, manager: AppWidgetManager, widgetId: Int, layoutId: Int, statusId: Int, e: Throwable, tag: String): Boolean {
        if (!isOffline(e)) return false
        val partial = RemoteViews(context.packageName, layoutId).apply {
            setTextViewText(statusId, statusText(context, e, tag))
        }
        manager.partiallyUpdateAppWidget(widgetId, partial)
        return true
    }

    /** "Loading…" on the status line only, keeping the current content. */
    fun showLoading(context: Context, manager: AppWidgetManager, widgetId: Int, layoutId: Int, statusId: Int) {
        val partial = RemoteViews(context.packageName, layoutId).apply {
            setTextViewText(statusId, context.getString(R.string.widget_loading))
        }
        manager.partiallyUpdateAppWidget(widgetId, partial)
    }
}
