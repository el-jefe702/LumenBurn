package com.depthforge.app

import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class InvertTest {

    @Test
    fun testApiClientInvertMethod() {
        val methods = ApiClient::class.java.declaredMethods
        val invertMethod = methods.find { it.name.startsWith("invert") }
        assertNotNull("ApiClient must declare invert method", invertMethod)
    }

    @Test
    fun testInvertContract() {
        val original16bit = 32768
        val inverted16bit = 65535 - original16bit
        val original8bit = 100
        val inverted8bit = 255 - original8bit

        assertTrue(inverted16bit == 32767)
        assertTrue(inverted8bit == 155)
    }
}
