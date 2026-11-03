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
    /** Writing area and excluded rects, physical screen px. Null = no plugin region. */
    var region: Rect? = null
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
    val wanted get() = region != null || globalMode

    /** Applies a `region` or `style` message. Returns true when raw drawing must be re-applied. */
    fun handle(type: String, msg: JSONObject): Boolean = when (type) {
        "region" -> {
            region = rect(msg.optJSONArray("rect"))
            val list = msg.optJSONArray("exclude") ?: JSONArray()
            exclude = (0 until list.length()).mapNotNull { rect(list.optJSONArray(it)) }
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

    /** Limit and exclude rects in overlay-local px for an overlay at (ox, oy) whose visible bounds are `full`. */
    fun limit(full: Rect, ox: Int, oy: Int): Pair<Rect, List<Rect>> {
        val r = region ?: return Pair(full, emptyList())
        val local = Rect(r.left - ox, r.top - oy, r.right - ox, r.bottom - oy)
        if (!local.intersect(full)) local.setEmpty()
        return Pair(local, exclude.map { Rect(it.left - ox, it.top - oy, it.right - ox, it.bottom - oy) })
    }

    private fun rect(a: JSONArray?): Rect? {
        if (a == null || a.length() != 4) return null
        val r = Rect(a.optInt(0), a.optInt(1), a.optInt(2), a.optInt(3))
        return if (r.width() > 0 && r.height() > 0) r else null
    }
}
