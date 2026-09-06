package com.depthforge.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionGalleryTest {

    @Test
    fun testSessionGalleryItemDataClass() {
        val item = SessionGalleryItem(
            id = "test-1",
            imageUrl = "http://localhost:8000/output/test.png",
            bitmap = null,
            label = "Generated",
            timestamp = "12:00:00"
        )
        assertEquals("test-1", item.id)
        assertEquals("http://localhost:8000/output/test.png", item.imageUrl)
        assertEquals("Generated", item.label)
        assertEquals("12:00:00", item.timestamp)
        assertNull(item.bitmap)
    }

    @Test
    fun testSessionGalleryManagerAddItem() {
        val list = emptyList<SessionGalleryItem>()
        val (list1, item1) = SessionGalleryManager.addItem(list, "/output/1.png", null, "Generated", "10:00:00")
        assertEquals(1, list1.size)
        assertEquals("Generated", item1.label)
        assertEquals("/output/1.png", item1.imageUrl)
        assertEquals("10:00:00", item1.timestamp)

        val (list2, item2) = SessionGalleryManager.addItem(list1, "/output/2.png", null, "Invert", "10:01:00")
        assertEquals(2, list2.size)
        assertEquals("Invert", item2.label)
        assertEquals(item1, list2[0])
        assertEquals(item2, list2[1])
    }

    @Test
    fun testSessionGalleryManagerFindItem() {
        val list = emptyList<SessionGalleryItem>()
        val (updated, item) = SessionGalleryManager.addItem(list, "/output/find.png", null, "Polish")
        val found = SessionGalleryManager.findItem(updated, item.id)
        assertNotNull(found)
        assertEquals(item.id, found?.id)
        assertEquals("Polish", found?.label)

        val notFound = SessionGalleryManager.findItem(updated, "non-existent")
        assertNull(notFound)
    }

    @Test
    fun testSessionGalleryManagerClear() {
        val list = emptyList<SessionGalleryItem>()
        val (list1, _) = SessionGalleryManager.addItem(list, "/output/1.png", null, "Generated")
        val (list2, _) = SessionGalleryManager.addItem(list1, "/output/2.png", null, "Invert")
        assertEquals(2, list2.size)

        val cleared = SessionGalleryManager.clear()
        assertEquals(0, cleared.size)
        assertTrue(cleared.isEmpty())
    }
}
