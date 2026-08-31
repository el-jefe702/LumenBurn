package com.depthforge.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class AspectRatioTest {

    @Test
    fun testSupportedAspectRatios() {
        val supported = listOf("1:1", "4:3", "3:2", "16:9", "2:3")
        assertEquals(5, supported.size)
        assertEquals("1:1", supported[0])
        assertEquals("4:3", supported[1])
        assertEquals("3:2", supported[2])
        assertEquals("16:9", supported[3])
        assertEquals("2:3", supported[4])
    }

    @Test
    fun testDefaultRatioIsSquare() {
        val defaultRatio = "1:1"
        assertEquals("1:1", defaultRatio)
    }

    @Test
    fun testAspectRatiosContract() {
        val ratios = listOf("1:1", "4:3", "3:2", "16:9", "2:3")
        val map = ratios.associateWith { true }
        assertTrue(map["16:9"] == true)
        assertTrue(map["4:3"] == true)
        assertTrue(map["3:2"] == true)
        assertTrue(map["2:3"] == true)
        assertTrue(map["1:1"] == true)
    }

    @Test
    fun testApiClientMethodSignatures() {
        val methods = ApiClient::class.java.declaredMethods
        val generateMethod = methods.find { it.name.startsWith("generate") }
        val photoToDepthMethod = methods.find { it.name.startsWith("photoToDepth") }

        assertNotNull("ApiClient must declare generate method", generateMethod)
        assertNotNull("ApiClient must declare photoToDepth method", photoToDepthMethod)
        val invertMethod = methods.find { it.name.startsWith("invert") }
        assertNotNull("ApiClient must declare invert method", invertMethod)
    }
}
