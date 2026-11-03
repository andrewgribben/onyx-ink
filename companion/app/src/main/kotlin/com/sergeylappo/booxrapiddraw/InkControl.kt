// onyx-ink: plugin-driven region, style and Global mode (SPEC 5.2, 5.3). Part of the Onyx Ink fork, MIT licence.
package com.sergeylappo.booxrapiddraw

import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.Rect
import com.onyx.android.sdk.pen.TouchHelper
import org.json.JSONArray
import org.json.JSONObject

/** What the plugin asked for. Only touched on the main thread. */
class InkControl(private val prefs: SharedPreferences) {
    /** Writing areas and excluded rects, physical screen px. Empty = no plugin region. */
    var regions: List<Rect> = emptyList()
        private set
    var exclude: List<Rect> = emptyList()
        private set
    var widthPx = 3f
        private set
    var color = Color.BLACK
        private set
    var style = TouchHelper.STROKE_STYLE_PENCIL
        private set

    /** Upstream behaviour: draw over the whole screen when no plugin has sent a region (Excalidraw, other apps). */
    var globalMode: Boolean
        get() = prefs.getBoolean("global_mode", false)
        set(value) {
            prefs.edit().putBoolean("global_mode", value).apply()
        }

    /** Raw drawing should run: a plugin region is set, or Global mode is on. */
    val wanted get() = regions.isNotEmpty() || globalMode

    /** Applies a `region` or `style` message. Returns true when raw drawing must be re-applied. */
    fun handle(type: String, msg: JSONObject): Boolean = when (type) {
        "region" -> {
            // "rects" (M5 inline blocks) wins over the single "rect"; rect null means no region.
            val single = rect(msg.optJSONArray("rect"))
            regions = if (single == null) emptyList() else rects(msg.optJSONArray("rects")).ifEmpty { listOf(single) }
            exclude = rects(msg.optJSONArray("exclude"))
            true
        }
        "style" -> {
            widthPx = msg.optDouble("widthPx", 3.0).toFloat().coerceIn(0.5f, 100f)
            color = try { Color.parseColor(msg.optString("color", "#000000")) } catch (e: IllegalArgumentException) { Color.BLACK }
            style = if (msg.optString("kind") == "marker") TouchHelper.STROKE_STYLE_MARKER else TouchHelper.STROKE_STYLE_PENCIL
            true
        }
        else -> false
    }

    /** Limit and exclude rects in overlay-local px for an overlay at (ox, oy) whose visible bounds are `full`. Empty limit = draw nowhere. */
    fun limit(full: Rect, ox: Int, oy: Int): Pair<List<Rect>, List<Rect>> {
        if (regions.isEmpty()) return Pair(listOf(full), emptyList())
        val local = regions.mapNotNull { r -> Rect(r.left - ox, r.top - oy, r.right - ox, r.bottom - oy).takeIf { it.intersect(full) } }
        return Pair(local, exclude.map { Rect(it.left - ox, it.top - oy, it.right - ox, it.bottom - oy) })
    }

    private fun rects(a: JSONArray?): List<Rect> = if (a == null) emptyList() else (0 until a.length()).mapNotNull { rect(a.optJSONArray(it)) }

    private fun rect(a: JSONArray?): Rect? {
        if (a == null || a.length() != 4) return null
        val r = Rect(a.optInt(0), a.optInt(1), a.optInt(2), a.optInt(3))
        return if (r.width() > 0 && r.height() > 0) r else null
    }
}
