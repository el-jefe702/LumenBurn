package com.depthforge.app

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.google.gson.Gson
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString

class WebSocketManager(private val url: String) {
    private val client = OkHttpClient()
    private var webSocket: WebSocket? = null
    private val gson = Gson()
    private val uiHandler = Handler(Looper.getMainLooper())

    fun connect(
        onOpen: () -> Unit = {},
        onJobUpdate: (Map<String, Any>) -> Unit = {},
        onFailure: (String) -> Unit = {}
    ) {
        val req = Request.Builder().url(url).build()
        webSocket = client.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: okhttp3.Response) {
                Log.i("WS", "Connected to $url")
                uiHandler.post { onOpen() }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val obj = gson.fromJson(text, Map::class.java)
                    if (obj != null && obj["type"] == "job_update") {
                        val job = obj["job"] as? Map<String, Any>
                        if (job != null) {
                            uiHandler.post { onJobUpdate(job) }
                        }
                    }
                } catch (e: Exception) {
                    Log.w("WS", "Failed to parse message: $text")
                }
            }

            override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
                onMessage(webSocket, bytes.utf8())
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
                Log.i("WS", "Closing: $code / $reason")
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: okhttp3.Response?) {
                Log.e("WS", "Failure: ${t.message}")
                uiHandler.post { onFailure(t.message ?: "Unknown error") }
            }
        })
    }

    fun close() {
        webSocket?.close(1000, "Client closing")
        client.dispatcher.executorService.shutdown()
    }
}
