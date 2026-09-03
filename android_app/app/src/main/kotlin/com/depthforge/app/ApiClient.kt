package com.depthforge.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONObject
import java.io.File
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

object ApiClient {
    var baseUrl = "http://4.3.2.122:8000/"

    private fun apiUrl(path: String): String {
        return baseUrl.removeSuffix("/") + path
    }

    // POST JSON, return parsed JSONObject
    private suspend fun postJson(path: String, body: JSONObject): JSONObject = withContext(Dispatchers.IO) {
        val conn = URL(apiUrl(path)).openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.doOutput = true
        conn.connectTimeout = 60000
        conn.readTimeout = 120000
        OutputStreamWriter(conn.outputStream).use { it.write(body.toString()) }
        val responseText = conn.inputStream.bufferedReader().readText()
        JSONObject(responseText)
    }

    // POST multipart file — uses OkHttp to correctly handle binary data
    private suspend fun postMultipart(
        path: String,
        file: File,
        fieldName: String,
        extraParams: Map<String, String> = emptyMap()
    ): JSONObject = withContext(Dispatchers.IO) {
        val client = OkHttpClient.Builder()
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(180, TimeUnit.SECONDS)
            .build()

        val mimeType = "image/*".toMediaTypeOrNull() ?: "application/octet-stream".toMediaTypeOrNull()!!
        val builder = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart(fieldName, file.name, file.asRequestBody(mimeType))

        for ((key, value) in extraParams) {
            builder.addFormDataPart(key, value)
        }

        val requestBody = builder.build()

        val request = Request.Builder()
            .url(apiUrl(path))
            .post(requestBody)
            .build()

        val response = client.newCall(request).execute()
        val responseText = response.body?.string() ?: "{}"
        JSONObject(responseText)
    }

    // Download image as Bitmap
    suspend fun downloadImage(urlPath: String): Bitmap? = withContext(Dispatchers.IO) {
        try {
            val fullUrl = if (urlPath.startsWith("http")) urlPath
                          else apiUrl(urlPath)
            val stream = URL(fullUrl).openStream()
            BitmapFactory.decodeStream(stream)
        } catch (e: Exception) { null }
    }

    // Generate depth map from text prompt with aspect ratio
    suspend fun generate(prompt: String, aspectRatio: String = "1:1"): JSONObject {
        val body = JSONObject().apply {
            put("prompt", prompt)
            put("aspectRatio", aspectRatio)
        }
        return postJson("/api/generate", body)
    }

    // Post-process (polish/smooth) an image
    suspend fun postprocess(imageUrl: String): JSONObject {
        return postJson("/api/postprocess", JSONObject().put("image_url", imageUrl))
    }

    // Post-process with real-time SSE progress streaming
    suspend fun postprocessStream(
        imageUrl: String,
        onProgress: (step: Int, message: String) -> Unit = { _, _ -> }
    ): JSONObject = withContext(Dispatchers.IO) {
        val client = OkHttpClient.Builder()
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(180, TimeUnit.SECONDS)
            .build()

        val encodedUrl = java.net.URLEncoder.encode(imageUrl, "UTF-8")
        val request = Request.Builder()
            .url(apiUrl("/api/postprocess-stream?image_url=$encodedUrl"))
            .header("Accept", "text/event-stream")
            .build()

        var resultJson = JSONObject()
        val response = client.newCall(request).execute()
        response.use { resp ->
            if (!resp.isSuccessful) {
                val errorBody = resp.body?.string() ?: ""
                return@withContext try {
                    JSONObject(errorBody)
                } catch (e: Exception) {
                    JSONObject().put("error", "HTTP ${resp.code}: ${resp.message}")
                }
            }
            resp.body?.byteStream()?.bufferedReader()?.use { reader ->
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    val currentLine = line ?: continue
                    if (currentLine.startsWith("data:")) {
                        val dataStr = currentLine.removePrefix("data:").trim()
                        if (dataStr.isNotEmpty()) {
                            try {
                                val json = JSONObject(dataStr)
                                if (json.has("step")) {
                                    val step = json.optInt("step", 1)
                                    val msg = json.optString("message", "")
                                    withContext(Dispatchers.Main) {
                                        onProgress(step, msg)
                                    }
                                }
                                if (json.optString("status") == "complete" || json.has("image_url") || json.has("error")) {
                                    resultJson = json
                                }
                            } catch (e: Exception) {
                                // ignore malformed line
                            }
                        }
                    }
                }
            }
        }
        resultJson
    }

    // Remove background
    suspend fun removeBg(imageUrl: String): JSONObject {
        return postJson("/api/remove_bg", JSONObject().put("image_url", imageUrl))
    }

    // Invert depth map
    suspend fun invert(imageUrl: String): JSONObject {
        return postJson("/api/invert", JSONObject().put("image_url", imageUrl))
    }

    // Convert photo to depth map with aspect ratio
    suspend fun photoToDepth(file: File, aspectRatio: String = "1:1"): JSONObject {
        return postMultipart("/api/photo-to-depth", file, "photo", mapOf("aspectRatio" to aspectRatio))
    }
}
