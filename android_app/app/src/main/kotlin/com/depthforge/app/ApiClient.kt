package com.depthforge.app

import com.google.gson.GsonBuilder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

object ApiClient {
    // Use 4.3.2.216 for the backend server
    private const val BASE = "http://4.3.2.216:8000/"

    private val gson = GsonBuilder().create()
    private val http = OkHttpClient.Builder().build()

    private suspend fun postJson(path: String, body: Map<String, Any>): Map<String, Any> = withContext(Dispatchers.IO) {
        val payload = gson.toJson(body)
        val req = Request.Builder()
            .url(BASE + path)
            .post(payload.toRequestBody("application/json".toMediaTypeOrNull()))
            .build()
        val resp = http.newCall(req).execute()
        if (!resp.isSuccessful) throw Exception("${path.removePrefix("api/").capitalize()} failed: ${resp.message}")
        val bodyText = resp.body?.string() ?: throw Exception("Empty response")
        return@withContext gson.fromJson(bodyText, Map::class.java) as Map<String, Any>
    }

    suspend fun generate(prompt: String): Map<String, Any> = postJson("api/generate", mapOf("prompt" to prompt))

    suspend fun postprocess(imageUrl: String): Map<String, Any> = postJson("api/postprocess", mapOf("image_url" to imageUrl))

    suspend fun preview3d(imageUrl: String): Map<String, Any> = postJson("api/preview3d", mapOf("image_url" to imageUrl))

    suspend fun prepareLaser(imageUrl: String): String = withContext(Dispatchers.IO) {
        val response = postJson("api/laser/prepare", mapOf("image_url" to imageUrl))
        return@withContext response["jobId"] as? String ?: throw Exception("Missing jobId")
    }

    suspend fun launchLaser(jobId: String, safetyConfirmed: Boolean): Map<String, Any> = postJson("api/laser/launch", mapOf("jobId" to jobId, "safetyConfirmed" to safetyConfirmed))

    suspend fun getStatus(jobId: String): Map<String, Any> = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url(BASE + "api/laser/status/" + jobId)
            .get()
            .build()
        val resp = http.newCall(req).execute()
        if (!resp.isSuccessful) throw Exception("Status failed: ${resp.message}")
        val body = resp.body?.string() ?: throw Exception("Empty response")
        return@withContext gson.fromJson(body, Map::class.java) as Map<String, Any>
    }
}
