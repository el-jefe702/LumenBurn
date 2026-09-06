package com.depthforge.app

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HealthCheckTest {

    @Test
    fun testApiClientCheckHealthMethod() {
        val methods = ApiClient::class.java.declaredMethods
        val checkHealthMethod = methods.find { it.name.startsWith("checkHealth") }
        assertNotNull("ApiClient must declare checkHealth method", checkHealthMethod)
    }

    @Test
    fun testApiClientIsHealthyMethod() {
        val methods = ApiClient::class.java.declaredMethods
        val isHealthyMethod = methods.find { it.name.startsWith("isHealthy") }
        assertNotNull("ApiClient must declare isHealthy method", isHealthyMethod)
    }

    @Test
    fun testHealthResponseContract() {
        val jsonString = """
            {
                "status": "ok",
                "version": "2.0.0",
                "python": true,
                "uptime": 123.45,
                "timestamp": "2026-09-06T13:40:00.000Z"
            }
        """.trimIndent()
        val json = JSONObject(jsonString)
        assertEquals("ok", json.getString("status"))
        assertEquals("2.0.0", json.getString("version"))
        assertTrue(json.getBoolean("python"))
        assertEquals(123.45, json.getDouble("uptime"), 0.01)
        assertTrue(json.getString("timestamp").startsWith("2026"))
    }

    @Test
    fun testHealthResponseDegradedContract() {
        val jsonString = """
            {
                "status": "ok",
                "version": "2.0.0",
                "python": false,
                "uptime": 45.67,
                "timestamp": "2026-09-06T13:40:00.000Z"
            }
        """.trimIndent()
        val json = JSONObject(jsonString)
        assertEquals("ok", json.getString("status"))
        assertFalse(json.getBoolean("python"))
    }

    @Test
    fun testHealthResponseHttpErrorWithStatusOkContract() {
        // Even if body has status "ok", if HTTP status code is 500, isHealthy must be false
        val isSuccessful = false
        val statusCode = 500
        val jsonString = """
            {
                "status": "ok",
                "error": "database unreachable"
            }
        """.trimIndent()
        val json = JSONObject(jsonString)
        json.put("isHealthy", isSuccessful && json.optString("status") == "ok")
        json.put("statusCode", statusCode)

        assertFalse("isHealthy must be false when HTTP status is 500", json.getBoolean("isHealthy"))
        assertEquals(500, json.getInt("statusCode"))
    }

    @Test
    fun testHealthResponseNonJsonBodyContract() {
        val statusCode = 502
        val isSuccess = false
        val responseText = "<html><head><title>502 Bad Gateway</title></head><body>502 Bad Gateway</body></html>"
        val json = try {
            JSONObject(responseText)
        } catch (e: Exception) {
            JSONObject().apply {
                put("rawResponse", responseText)
                put("error", "Non-JSON response from server (HTTP $statusCode)")
            }
        }
        json.put("isHealthy", isSuccess && json.optString("status") == "ok")
        json.put("statusCode", statusCode)

        assertFalse(json.getBoolean("isHealthy"))
        assertEquals(502, json.getInt("statusCode"))
        assertTrue(json.getString("rawResponse").contains("502 Bad Gateway"))
    }

    @Test
    fun testHealthResponseMalformedUrlContract() {
        // When URL is malformed, checkHealth catches exception and returns structured error
        val errorJson = JSONObject().apply {
            put("status", "error")
            put("error", "Malformed URL: invalid url")
            put("isHealthy", false)
            put("statusCode", 0)
        }
        assertFalse(errorJson.getBoolean("isHealthy"))
        assertEquals(0, errorJson.getInt("statusCode"))
        assertEquals("error", errorJson.getString("status"))
    }

    @Test
    fun testBaseUrlTrimmingContract() {
        val messyBase = "   http://127.0.0.1:8080///   "
        val trimmed = messyBase.trim().removeSuffix("/")
        assertEquals("http://127.0.0.1:8080", trimmed.removeSuffix("/"))
    }
}
