package com.depthforge.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

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
    // (raw HttpURLConnection with a char-based BufferedWriter can corrupt binary payloads)
    private suspend fun postMultipart(path: String, file: File, fieldName: String): JSONObject = withContext(Dispatchers.IO) {
        val client = okhttp3.OkHttpClient.Builder()
            .connectTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(180, java.util.concurrent.TimeUnit.SECONDS)
            .build()

        val mimeType = okhttp3.MediaType.parse("image/*") ?: okhttp3.MediaType.parse("application/octet-stream")!!
        val requestBody = okhttp3.MultipartBody.Builder()
            .setType(okhttp3.MultipartBody.FORM)
            .addFormDataPart(fieldName, file.name, okhttp3.RequestBody.create(mimeType, file))
            .build()

        val request = okhttp3.Request.Builder()
            .url(apiUrl(path))
            .post(requestBody)
            .build()

        val response = client.newCall(request).execute()
        val responseText = response.body()?.string() ?: "{}"
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

    // Generate depth map from text prompt
    suspend fun generate(prompt: String): JSONObject {
        return postJson("/api/generate", JSONObject().put("prompt", prompt))
    }

    // Post-process (polish/smooth) an image
    suspend fun postprocess(imageUrl: String): JSONObject {
        return postJson("/api/postprocess", JSONObject().put("image_url", imageUrl))
    }

    // Remove background
    suspend fun removeBg(imageUrl: String): JSONObject {
        return postJson("/api/remove_bg", JSONObject().put("image_url", imageUrl))
    }

    // Convert photo to depth map
    suspend fun photoToDepth(file: File): JSONObject {
        return postMultipart("/api/photo-to-depth", file, "photo")
    }
}
