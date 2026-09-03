package com.depthforge.app

import android.content.SharedPreferences
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class PromptHistoryTest {

    private class FakeEditor(private val map: MutableMap<String, Any?>) : SharedPreferences.Editor {
        private val temp = mutableMapOf<String, Any?>()
        private val toRemove = mutableSetOf<String>()

        override fun putString(key: String?, value: String?): SharedPreferences.Editor {
            if (key != null) {
                if (value != null) temp[key] = value else toRemove.add(key)
            }
            return this
        }

        override fun putStringSet(key: String?, values: MutableSet<String>?): SharedPreferences.Editor = this
        override fun putInt(key: String?, value: Int): SharedPreferences.Editor = this
        override fun putLong(key: String?, value: Long): SharedPreferences.Editor = this
        override fun putFloat(key: String?, value: Float): SharedPreferences.Editor = this
        override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor = this

        override fun remove(key: String?): SharedPreferences.Editor {
            if (key != null) toRemove.add(key)
            return this
        }

        override fun clear(): SharedPreferences.Editor {
            map.clear()
            temp.clear()
            toRemove.clear()
            return this
        }

        override fun commit(): Boolean {
            apply()
            return true
        }

        override fun apply() {
            toRemove.forEach { map.remove(it) }
            map.putAll(temp)
            temp.clear()
            toRemove.clear()
        }
    }

    private class FakeSharedPreferences : SharedPreferences {
        private val map = mutableMapOf<String, Any?>()

        override fun getAll(): MutableMap<String, *> = map
        override fun getString(key: String?, defValue: String?): String? = map[key] as? String ?: defValue
        override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? = null
        override fun getInt(key: String?, defValue: Int): Int = defValue
        override fun getLong(key: String?, defValue: Long): Long = defValue
        override fun getFloat(key: String?, defValue: Float): Float = defValue
        override fun getBoolean(key: String?, defValue: Boolean): Boolean = defValue
        override fun contains(key: String?): Boolean = map.containsKey(key)
        override fun edit(): SharedPreferences.Editor = FakeEditor(map)
        override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}
        override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}
    }

    private lateinit var fakePrefs: FakeSharedPreferences

    @Before
    fun setup() {
        fakePrefs = FakeSharedPreferences()
    }

    @Test
    fun testConstants() {
        assertEquals("depthforge_prompt_history", PromptHistoryManager.PREFS_KEY)
        assertEquals(10, PromptHistoryManager.MAX_ITEMS)
    }

    @Test
    fun testEmptyHistoryInitially() {
        val history = PromptHistoryManager.getHistory(fakePrefs)
        assertTrue(history.isEmpty())
    }

    @Test
    fun testSaveSinglePrompt() {
        val result = PromptHistoryManager.savePrompt(fakePrefs, "Gothic cathedral arch relief")
        assertEquals(1, result.size)
        assertEquals("Gothic cathedral arch relief", result[0])

        val retrieved = PromptHistoryManager.getHistory(fakePrefs)
        assertEquals(1, retrieved.size)
        assertEquals("Gothic cathedral arch relief", retrieved[0])
    }

    @Test
    fun testPromptHistoryCappedAtTen() {
        for (i in 1..15) {
            PromptHistoryManager.savePrompt(fakePrefs, "Prompt #$i")
        }

        val history = PromptHistoryManager.getHistory(fakePrefs)
        assertEquals(10, history.size)
        assertEquals("Prompt #15", history[0])
        assertEquals("Prompt #6", history[9])
        assertTrue(!history.contains("Prompt #1"))
        assertTrue(!history.contains("Prompt #5"))
    }

    @Test
    fun testDeduplicationAndPromotion() {
        PromptHistoryManager.savePrompt(fakePrefs, "Lion head")
        PromptHistoryManager.savePrompt(fakePrefs, "Eagle wings")
        PromptHistoryManager.savePrompt(fakePrefs, "Wolf pack")
        PromptHistoryManager.savePrompt(fakePrefs, "Lion head")

        val history = PromptHistoryManager.getHistory(fakePrefs)
        assertEquals(3, history.size)
        assertEquals("Lion head", history[0])
        assertEquals("Wolf pack", history[1])
        assertEquals("Eagle wings", history[2])
    }

    @Test
    fun testIgnoreBlankPrompts() {
        PromptHistoryManager.savePrompt(fakePrefs, "")
        PromptHistoryManager.savePrompt(fakePrefs, "   ")
        val history = PromptHistoryManager.getHistory(fakePrefs)
        assertTrue(history.isEmpty())
    }

    @Test
    fun testClearHistory() {
        PromptHistoryManager.savePrompt(fakePrefs, "Carving 1")
        PromptHistoryManager.savePrompt(fakePrefs, "Carving 2")
        assertEquals(2, PromptHistoryManager.getHistory(fakePrefs).size)

        PromptHistoryManager.clearHistory(fakePrefs)
        assertTrue(PromptHistoryManager.getHistory(fakePrefs).isEmpty())
    }

    @Test
    fun testMalformedJsonHandling() {
        fakePrefs.edit().putString(PromptHistoryManager.PREFS_KEY, "invalid json {[").apply()
        val history = PromptHistoryManager.getHistory(fakePrefs)
        assertTrue(history.isEmpty())
    }

    @Test
    fun testJsonObjectInsteadOfArray() {
        fakePrefs.edit().putString(PromptHistoryManager.PREFS_KEY, "{\"key\": \"val\"}").apply()
        val history = PromptHistoryManager.getHistory(fakePrefs)
        assertTrue(history.isEmpty())
    }

    @Test
    fun testJsonArrayWithBlanksAndWhitespace() {
        fakePrefs.edit().putString(PromptHistoryManager.PREFS_KEY, "[\"\", \"   \", \"Valid Carving\", null]").apply()
        val history = PromptHistoryManager.getHistory(fakePrefs)
        assertEquals(1, history.size)
        assertEquals("Valid Carving", history[0])
    }

    @Test
    fun testTrimWhitespaceOnSave() {
        PromptHistoryManager.savePrompt(fakePrefs, "  Lion with mane  ")
        val history = PromptHistoryManager.getHistory(fakePrefs)
        assertEquals(1, history.size)
        assertEquals("Lion with mane", history[0])
    }

    @Test
    fun testDeduplicateWithWhitespace() {
        PromptHistoryManager.savePrompt(fakePrefs, "Dragon")
        PromptHistoryManager.savePrompt(fakePrefs, "  Dragon  ")
        val history = PromptHistoryManager.getHistory(fakePrefs)
        assertEquals(1, history.size)
        assertEquals("Dragon", history[0])
    }

    @Test
    fun testClearOnEmptyHistoryNoCrash() {
        PromptHistoryManager.clearHistory(fakePrefs)
        assertTrue(PromptHistoryManager.getHistory(fakePrefs).isEmpty())
    }

    @Test
    fun testMultilineAndUnicodePrompt() {
        val complexPrompt = "🐉 Ancient Dragon Relief\nIntricate scales & horns\n\"16-bit CNC masterpiece\""
        PromptHistoryManager.savePrompt(fakePrefs, complexPrompt)
        val history = PromptHistoryManager.getHistory(fakePrefs)
        assertEquals(1, history.size)
        assertEquals(complexPrompt, history[0])
    }

    @Test
    fun testEmptyStringPref() {
        fakePrefs.edit().putString(PromptHistoryManager.PREFS_KEY, "").apply()
        val history = PromptHistoryManager.getHistory(fakePrefs)
        assertTrue(history.isEmpty())
    }
}
