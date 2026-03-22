package dev.kambei.habitikami.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import dev.kambei.habitikami.R

class HelpWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) {
            val views = RemoteViews(context.packageName, R.layout.widget_help)

            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://habitikami.kambei.dev/#Help"))
            val pending = PendingIntent.getActivity(
                context, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.btn_help, pending)

            manager.updateAppWidget(id, views)
        }
    }
}
