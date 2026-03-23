package dev.kambei.habitikami.widget

import android.graphics.*
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

object ChartRenderer {

    // ── Colors matching the app theme ──────────────────────────────────────────

    private const val COLOR_BG = 0xFF0A0A0F.toInt()
    private const val COLOR_PRIMARY = 0xFF7C3AED.toInt()
    private const val COLOR_GREEN = 0xFF22C55E.toInt()
    private const val COLOR_RED = 0xFFEF4444.toInt()
    private const val COLOR_AMBER = 0xFFF59E0B.toInt()
    private const val COLOR_MUTED = 0xFF3F3F5F.toInt()
    private const val COLOR_TEXT = 0xFFE0E0E0.toInt()
    private const val COLOR_TEXT_DIM = 0xFF888899.toInt()

    // ── Heatmap ────────────────────────────────────────────────────────────────
    // GitHub-style contribution heatmap: rows = habits, cols = days

    // Fallback colors when API doesn't provide them
    private val HABIT_COLORS = intArrayOf(
        0xFF7C3AED.toInt(), // purple
        0xFF22C55E.toInt(), // green
        0xFF3B82F6.toInt(), // blue
        0xFFF59E0B.toInt(), // amber
        0xFFEF4444.toInt(), // red
        0xFF06B6D4.toInt(), // cyan
        0xFFF472B6.toInt(), // pink
        0xFFA78BFA.toInt(), // violet
        0xFF10B981.toInt(), // emerald
        0xFFFB923C.toInt(), // orange
        0xFF8B5CF6.toInt(), // indigo
        0xFFEC4899.toInt(), // rose
        0xFF14B8A6.toInt(), // teal
        0xFFD97706.toInt(), // dark amber
        0xFF6366F1.toInt(), // slate blue
        0xFF84CC16.toInt(), // lime
    )

    /** Get a deterministic fallback color for a habit based on its name hash. */
    private fun fallbackColor(habitName: String): Int {
        val hash = habitName.hashCode().and(0x7FFFFFFF) // positive hash
        return HABIT_COLORS[hash % HABIT_COLORS.size]
    }

    fun renderHeatmap(
        data: List<DayEntry>,
        width: Int,
        height: Int,
        habitColors: Map<String, Int> = emptyMap(),
        habitOrder: List<String> = emptyList(),
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.TRANSPARENT)

        if (data.isEmpty()) {
            drawCenteredText(canvas, "No habit data", width, height)
            return bitmap
        }

        // Use custom order if provided, otherwise alphabetical
        val available = data.flatMap { it.habits.keys }.distinct().toSet()
        val allHabits = if (habitOrder.isNotEmpty()) {
            val ordered = habitOrder.filter { it in available }.toMutableList()
            val remaining = available.filter { it !in ordered }.sorted()
            ordered + remaining
        } else {
            available.sorted()
        }
        if (allHabits.isEmpty()) {
            drawCenteredText(canvas, "No habits found", width, height)
            return bitmap
        }

        val sortedDays = data.sortedBy { it.date }.takeLast(21)

        val rows = allHabits.size
        val cols = sortedDays.size
        val padding = 8f

        // Title
        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_PRIMARY
            textSize = 20f
            typeface = Typeface.DEFAULT_BOLD
            textAlign = Paint.Align.CENTER
        }
        val titleH = 32f
        canvas.drawText("Habitikami Stats", width / 2f, titleH - 8f, titlePaint)

        // ── Auto-scale legend based on habit count ──
        // Fewer habits → bigger legend text, more habits → smaller + more columns
        val legendCols = when {
            rows <= 6 -> 2
            rows <= 12 -> 3
            else -> 4
        }
        val legendTextSize = when {
            rows <= 6 -> 22f
            rows <= 10 -> 18f
            rows <= 16 -> 14f
            else -> 11f
        }
        val legendLineH = legendTextSize + 12f
        val legendLines = ((rows + legendCols - 1) / legendCols).coerceAtLeast(1)
        val legendTotalH = legendLines * legendLineH + 20f

        val legendPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_TEXT
            textSize = legendTextSize
            typeface = Typeface.DEFAULT_BOLD
        }

        // ── Heatmap fills space between title and legend ──
        val areaTop = titleH + padding
        val areaH = height - areaTop - legendTotalH
        val gap = when {
            rows <= 8 -> 3f
            rows <= 16 -> 2f
            else -> 1f
        }

        // Calculate cell size to fill the area — no min/max clamp so it always fits
        val maxCellH = (areaH - (rows - 1) * gap) / rows.coerceAtLeast(1)
        val maxCellW = (width - 2 * padding - (cols - 1) * gap) / cols.coerceAtLeast(1)
        val cellSize = min(maxCellW, maxCellH).coerceAtLeast(2f)

        // Center the grid
        val gridW = cols * (cellSize + gap) - gap
        val gridH = rows * (cellSize + gap) - gap
        val offsetX = (width - gridW) / 2f
        val offsetY = areaTop + (areaH - gridH) / 2f

        val cornerRadius = (cellSize / 5f).coerceIn(1f, 4f)
        val cellPaint = Paint(Paint.ANTI_ALIAS_FLAG)

        for (r in allHabits.indices) {
            val habitColor = habitColors[allHabits[r]] ?: fallbackColor(allHabits[r])
            val cy = offsetY + r * (cellSize + gap)

            for (c in sortedDays.indices) {
                val completed = sortedDays[c].habits[allHabits[r]] == true
                cellPaint.color = if (completed) habitColor else COLOR_MUTED

                val x = offsetX + c * (cellSize + gap)
                canvas.drawRoundRect(x, cy, x + cellSize, cy + cellSize, cornerRadius, cornerRadius, cellPaint)
            }
        }

        // ── Legend at bottom — auto-scaled ──
        val legendTop = height - legendTotalH + 8f
        val colWidth = width / legendCols.toFloat()
        val dotSize = (legendTextSize * 0.7f).coerceIn(8f, 18f)
        val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG)

        for (i in allHabits.indices) {
            val col = i % legendCols
            val row = i / legendCols
            val lx = col * colWidth + 12f
            val ly = legendTop + row * legendLineH

            val legendColor = habitColors[allHabits[i]] ?: fallbackColor(allHabits[i])

            // Color dot
            dotPaint.color = legendColor
            canvas.drawRoundRect(lx, ly, lx + dotSize, ly + dotSize, 3f, 3f, dotPaint)

            // Habit name — truncate if needed to fit column
            legendPaint.color = legendColor
            legendPaint.textSize = legendTextSize
            val maxTextW = colWidth - dotSize - 24f
            var displayName = allHabits[i]
            while (legendPaint.measureText(displayName) > maxTextW && displayName.length > 3) {
                displayName = displayName.dropLast(1)
            }
            if (displayName != allHabits[i]) displayName += "…"
            canvas.drawText(displayName, lx + dotSize + 6f, ly + dotSize - 1f, legendPaint)
        }

        return bitmap
    }

    // ── Radar / Spider Chart ───────────────────────────────────────────────────
    // Shows completion rate per habit as a polygon on a radial grid

    fun renderRadar(
        data: List<DayEntry>,
        width: Int,
        height: Int,
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.TRANSPARENT)

        if (data.isEmpty()) {
            drawCenteredText(canvas, "No habit data", width, height)
            return bitmap
        }

        // Calculate completion rate per habit
        val allHabits = data.flatMap { it.habits.keys }.distinct().take(8)
        if (allHabits.size < 3) {
            drawCenteredText(canvas, "Need 3+ habits", width, height)
            return bitmap
        }

        val rates = allHabits.map { habit ->
            val total = data.count { it.habits.containsKey(habit) }
            val done = data.count { it.habits[habit] == true }
            if (total > 0) done.toFloat() / total else 0f
        }

        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_PRIMARY
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
        }

        val titleH = 28f
        canvas.drawText("Radar", 12f, titleH - 6f, titlePaint)

        val cx = width / 2f
        val cy = titleH + (height - titleH) / 2f
        // Use nearly all available space — only reserve room for labels
        val labelMargin = 22f
        val radius = (min(width.toFloat(), height - titleH) / 2f - labelMargin).coerceAtLeast(30f)
        val n = allHabits.size

        // Grid circles
        val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED
            style = Paint.Style.STROKE
            strokeWidth = 1f
        }
        for (ring in 1..3) {
            canvas.drawCircle(cx, cy, radius * ring / 3f, gridPaint)
        }

        // Grid lines from center to each axis
        val angles = List(n) { i -> Math.toRadians((360.0 / n * i) - 90.0) }
        for (a in angles) {
            canvas.drawLine(cx, cy, cx + radius * cos(a).toFloat(), cy + radius * sin(a).toFloat(), gridPaint)
        }

        // Data polygon
        val path = Path()
        val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = (COLOR_PRIMARY and 0x00FFFFFF) or 0x55000000 // 33% alpha
            style = Paint.Style.FILL
        }
        val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_PRIMARY
            style = Paint.Style.STROKE
            strokeWidth = 2f
        }

        for (i in rates.indices) {
            val r = radius * rates[i]
            val x = cx + r * cos(angles[i]).toFloat()
            val y = cy + r * sin(angles[i]).toFloat()
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        path.close()
        canvas.drawPath(path, fillPaint)
        canvas.drawPath(path, strokePaint)

        // Dots and labels
        val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
        val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_TEXT
            textSize = 9f
            textAlign = Paint.Align.CENTER
        }

        for (i in allHabits.indices) {
            val r = radius * rates[i]
            val dx = cx + r * cos(angles[i]).toFloat()
            val dy = cy + r * sin(angles[i]).toFloat()
            canvas.drawCircle(dx, dy, 3f, dotPaint)

            // Label at edge
            val lx = cx + (radius + 14f) * cos(angles[i]).toFloat()
            val ly = cy + (radius + 14f) * sin(angles[i]).toFloat() + 3f
            canvas.drawText(allHabits[i].take(5), lx, ly, labelPaint)
        }

        return bitmap
    }

    // ── Counter Bars ───────────────────────────────────────────────────────────
    // Grouped bar chart: last N days of smoke/smoked/coffee

    fun renderCounterBars(
        data: List<CounterEntry>,
        width: Int,
        height: Int,
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.TRANSPARENT)

        if (data.isEmpty()) {
            drawCenteredText(canvas, "No counter data", width, height)
            return bitmap
        }

        val sorted = data.sortedBy { it.date }.takeLast(14) // last 2 weeks

        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_PRIMARY
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
        }

        val titleH = 22f
        canvas.drawText("Counters", 8f, titleH - 6f, titlePaint)

        val marginL = 8f
        val marginR = 8f
        val marginB = 18f
        val areaTop = titleH + 4f
        val areaW = width - marginL - marginR
        val areaH = height - areaTop - marginB

        val maxVal = sorted.maxOf { maxOf(it.smoke, it.smoked, it.coffee) }.coerceAtLeast(1)
        val groupW = areaW / sorted.size
        val barW = (groupW / 4f).coerceAtMost(10f)

        val paints = listOf(
            Paint(Paint.ANTI_ALIAS_FLAG).apply { color = COLOR_GREEN },
            Paint(Paint.ANTI_ALIAS_FLAG).apply { color = COLOR_RED },
            Paint(Paint.ANTI_ALIAS_FLAG).apply { color = COLOR_AMBER },
        )

        // Baseline
        val basePaint = Paint().apply { color = COLOR_MUTED; strokeWidth = 1f }
        val baseY = areaTop + areaH
        canvas.drawLine(marginL, baseY, width - marginR, baseY, basePaint)

        val datePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_TEXT_DIM
            textSize = 7f
            textAlign = Paint.Align.CENTER
        }

        for ((i, entry) in sorted.withIndex()) {
            val groupX = marginL + i * groupW + groupW / 2f
            val vals = listOf(entry.smoke, entry.smoked, entry.coffee)

            for ((j, v) in vals.withIndex()) {
                val barH = (v.toFloat() / maxVal) * areaH
                val x = groupX + (j - 1) * (barW + 1f) - barW / 2f
                canvas.drawRoundRect(x, baseY - barH, x + barW, baseY, 2f, 2f, paints[j])
            }

            // Date label (show day number)
            val dayLabel = entry.date.takeLast(2)
            canvas.drawText(dayLabel, groupX, baseY + 12f, datePaint)
        }

        // Legend
        val legendY = titleH - 6f
        val legendPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = 9f
            color = COLOR_TEXT_DIM
        }
        val labels = listOf("Resist" to COLOR_GREEN, "Smoked" to COLOR_RED, "Coffee" to COLOR_AMBER)
        var lx = width - 8f
        for ((label, color) in labels.reversed()) {
            val tw = legendPaint.measureText(label)
            lx -= tw
            legendPaint.color = color
            canvas.drawText(label, lx, legendY, legendPaint)
            lx -= 10f
        }

        return bitmap
    }

    // ── Composite ──────────────────────────────────────────────────────────────
    // Renders all three charts stacked vertically into one bitmap

    fun renderComposite(
        export: ExportData,
        width: Int,
        height: Int,
        habitOrder: List<String> = emptyList(),
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.TRANSPARENT)

        val allDays = export.weekdays + export.weekend

        val heatmap = renderHeatmap(allDays, width, height, export.colors, habitOrder)
        canvas.drawBitmap(heatmap, 0f, 0f, null)
        heatmap.recycle()

        return bitmap
    }

    private fun drawCenteredText(canvas: Canvas, text: String, w: Int, h: Int) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_TEXT_DIM
            textSize = 12f
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText(text, w / 2f, h / 2f, paint)
    }
}
