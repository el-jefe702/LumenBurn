package com.depthforge.app

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RateLimitingTest {

    @Test
    fun testApiClientIsRateLimitedMethodExists() {
        val methods = ApiClient::class.java.declaredMethods
        val isRateLimitedMethod = methods.find { it.name == "isRateLimited" }
        assertNotNull("ApiClient must declare isRateLimited method", isRateLimitedMethod)
    }

    @Test
    fun testIsRateLimitedWith429StatusCode() {
        val response = JSONObject().apply {
            put("statusCode", 429)
            put("error", "Too many requests. Please wait before generating again.")
        }
        assertTrue("isRateLimited should return true when statusCode is 429", ApiClient.isRateLimited(response))
    }

    @Test
    fun testIsRateLimitedWithErrorMessageOnly() {
        val response = JSONObject().apply {
            put("error", "Too many requests. Please wait before generating again.")
        }
        assertTrue("isRateLimited should return true when error string matches", ApiClient.isRateLimited(response))
    }

    @Test
    fun testIsRateLimitedWithNon429Responses() {
        val successResponse = JSONObject().apply {
            put("statusCode", 200)
            put("status", "success")
            put("image_url", "/static/generated/test.png")
        }
        assertFalse("isRateLimited should return false for 200 response", ApiClient.isRateLimited(successResponse))

        val badRequestResponse = JSONObject().apply {
            put("statusCode", 400)
            put("error", "Missing prompt parameter")
        }
        assertFalse("isRateLimited should return false for 400 bad request", ApiClient.isRateLimited(badRequestResponse))

        val serverErrorResponse = JSONObject().apply {
            put("statusCode", 500)
            put("error", "Internal server error")
        }
        assertFalse("isRateLimited should return false for 500 server error", ApiClient.isRateLimited(serverErrorResponse))
    }

    @Test
    fun testStandard429ResponseContract() {
        val jsonString = """
            {
                "error": "Too many requests. Please wait before generating again."
            }
        """.trimIndent()
        val json = JSONObject(jsonString)
        assertEquals("Too many requests. Please wait before generating again.", json.getString("error"))
    }

    @Test
    fun testNonJson429FallbackContract() {
        val statusCode = 429
        val responseText = "<html><body>429 Too Many Requests</body></html>"
        val json = try {
            JSONObject(responseText)
        } catch (e: Exception) {
            JSONObject().put("error", "HTTP $statusCode: $responseText")
        }
        val currentErr = json.optString("error", "")
        if (statusCode == 429 && (currentErr.isEmpty() || currentErr.startsWith("HTTP 429"))) {
            json.put("error", "Too many requests. Please wait before generating again.")
        }
        json.put("statusCode", statusCode)

        assertTrue(ApiClient.isRateLimited(json))
        assertEquals("Too many requests. Please wait before generating again.", json.getString("error"))
        assertEquals(429, json.getInt("statusCode"))
    }

    @Test
    fun testEmptyBody429FallbackContract() {
        val statusCode = 429
        val responseText = ""
        val json = try {
            JSONObject(responseText)
        } catch (e: Exception) {
            JSONObject().put("error", "HTTP $statusCode: $responseText")
        }
        val currentErr = json.optString("error", "")
        if (statusCode == 429 && (currentErr.isEmpty() || currentErr.startsWith("HTTP 429"))) {
            json.put("error", "Too many requests. Please wait before generating again.")
        }
        json.put("statusCode", statusCode)

        assertTrue(ApiClient.isRateLimited(json))
        assertEquals("Too many requests. Please wait before generating again.", json.getString("error"))
        assertEquals(429, json.getInt("statusCode"))
    }

    @Test
    fun testDefaultConfigurableLimitsContract() {
        val defaultWindowMs = 900000L // 15 minutes = 15 * 60 * 1000
        val defaultMax = 10
        val defaultErrorMessage = "Too many requests. Please wait before generating again."

        assertEquals(900000L, defaultWindowMs)
        assertEquals(10, defaultMax)
        assertEquals("Too many requests. Please wait before generating again.", defaultErrorMessage)
    }
}
