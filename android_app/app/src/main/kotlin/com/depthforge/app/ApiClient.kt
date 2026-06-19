package com.depthforge.app

import com.google.gson.GsonBuilder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

object ApiClient {
    // Dynamic Base URL that can be customized in settings
    var baseUrl: String = "http://10.0.2.2:8000/"

    private val gson = GsonBuilder().create()
    
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private suspend fun postJson(path: String, body: Map<String, Any>): Map<String, Any> = withContext(Dispatchers.IO) {
        val payload = gson.toJson(body)
        val fullUrl = baseUrl.removeSuffix("/") + "/" + path.removePrefix("/")
        val req = Request.Builder()
            .url(fullUrl)
            .post(payload.toRequestBody("application/json".toMediaTypeOrNull()))
            .build()
        
        http.newCall(req).execute().use { resp ->
            val bodyText = resp.body?.string() ?: ""
            if (!resp.isSuccessful) {
                throw Exception("Request failed (${resp.code}): $bodyText")
            }
            if (bodyText.isBlank()) throw Exception("Empty response")
            return@withContext gson.fromJson(bodyText, Map::class.java) as Map<String, Any>
        }
    }

    private suspend fun getJson(path: String): Any = withContext(Dispatchers.IO) {
        val fullUrl = baseUrl.removeSuffix("/") + "/" + path.removePrefix("/")
        val req = Request.Builder()
            .url(fullUrl)
            .get()
            .build()
        
        http.newCall(req).execute().use { resp ->
            val bodyText = resp.body?.string() ?: ""
            if (!resp.isSuccessful) {
                throw Exception("GET failed (${resp.code}): $bodyText")
            }
            if (bodyText.isBlank()) throw Exception("Empty response")
            return@withContext gson.fromJson(bodyText, Any::class.java)
        }
    }

    // --- Core Functions ---

    suspend fun generate(prompt: String): Map<String, Any> = postJson("api/generate", mapOf("prompt" to prompt))

    suspend fun postprocess(imageUrl: String): Map<String, Any> = postJson("api/postprocess", mapOf("image_url" to imageUrl))

    suspend fun preview3d(imageUrl: String): Map<String, Any> = postJson("api/preview3d", mapOf("image_url" to imageUrl))

    // --- Laser Admin Queue Functions ---

    suspend fun sendToAdminQueue(imageUrl: String, studentName: String): Map<String, Any> =
        postJson("api/laser/lightburn", mapOf("image_url" to imageUrl, "student_name" to studentName, "auto_open" to false))

    suspend fun openInLightburn(imageUrl: String): Map<String, Any> =
        postJson("api/laser/lightburn", mapOf("image_url" to imageUrl, "auto_open" to true))

    suspend fun getQueue(): List<Map<String, Any>> = withContext(Dispatchers.IO) {
        val data = getJson("api/admin/queue")
        return@withContext data as? List<Map<String, Any>> ?: emptyList()
    }

    // --- Lead Submission ---

    suspend fun submitLead(name: String, email: String, premiumInterest: Boolean): Map<String, Any> =
        postJson("api/lead", mapOf("name" to name, "email" to email, "premium_interest" to premiumInterest))

    suspend fun getLeads(): List<Map<String, Any>> = withContext(Dispatchers.IO) {
        val data = getJson("api/admin/leads")
        return@withContext data as? List<Map<String, Any>> ?: emptyList()
    }

    // --- Direct Laser Control (Ruida Scaffold) ---

    suspend fun prepareLaser(imageUrl: String): String = withContext(Dispatchers.IO) {
        val response = postJson("api/laser/prepare", mapOf("image_url" to imageUrl))
        return@withContext response["jobId"] as? String ?: throw Exception("Missing jobId")
    }

    suspend fun launchLaser(jobId: String, safetyConfirmed: Boolean): Map<String, Any> =
        postJson("api/laser/launch", mapOf("jobId" to jobId, "safetyConfirmed" to safetyConfirmed))

    suspend fun getStatus(jobId: String): Map<String, Any> = withContext(Dispatchers.IO) {
        val fullUrl = baseUrl.removeSuffix("/") + "/api/laser/status/" + jobId
        val req = Request.Builder()
            .url(fullUrl)
            .get()
            .build()
        http.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) throw Exception("Status failed (${resp.code})")
            val body = resp.body?.string() ?: throw Exception("Empty response")
            return@withContext gson.fromJson(body, Map::class.java) as Map<String, Any>
        }
    }

    // --- Chat Support ---

    suspend fun chat(message: String, sessionId: String): Map<String, Any> =
        postJson("api/chat", mapOf("message" to message, "sessionId" to sessionId))

    // --- Helper to Download Image Bytes ---

    suspend fun downloadImage(url: String): ByteArray? = withContext(Dispatchers.IO) {
        var targetUrl = url.trim()
        // If the server returns localhost/127.0.0.1, we must translate it for the emulator/device
        if (targetUrl.contains("://localhost") || targetUrl.contains("://127.0.0.1")) {
            val baseHost = baseUrl.substringAfter("://").substringBefore("/")
            targetUrl = targetUrl
                .replace("localhost", baseHost.substringBefore(":"))
                .replace("127.0.0.1", baseHost.substringBefore(":"))
        }

        val fullUrl = if (targetUrl.startsWith("http")) targetUrl else baseUrl.removeSuffix("/") + "/" + targetUrl.removePrefix("/")
        val req = Request.Builder().url(fullUrl).build()
        try {
            http.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return@withContext null
                return@withContext resp.body?.bytes()
            }
        } catch (e: Exception) {
            return@withContext null
        }
    }
}
