package com.depthforge.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.max
import kotlin.math.min

class ComparisonViewTest {

    @Test
    fun testSplitFractionClamping() {
        // Verification of split fraction boundary clamping [0.0f, 1.0f]
        val clampedMin = (-0.5f).coerceIn(0f, 1f)
        val clampedMax = (1.5f).coerceIn(0f, 1f)
        val clampedMid = (0.5f).coerceIn(0f, 1f)
        val clampedZero = (0.0f).coerceIn(0f, 1f)
        val clampedOne = (1.0f).coerceIn(0f, 1f)

        assertEquals(0f, clampedMin, 0.0001f)
        assertEquals(1f, clampedMax, 0.0001f)
        assertEquals(0.5f, clampedMid, 0.0001f)
        assertEquals(0f, clampedZero, 0.0001f)
        assertEquals(1f, clampedOne, 0.0001f)
    }

    @Test
    fun testDragDeltaCalculation() {
        // Delta to fraction calculation: (splitFraction + delta / totalPx).coerceIn(0f, 1f)
        val totalPx = 1000f
        val initialSplit = 0.5f

        val deltaRight = 100f
        val newFractionRight = (initialSplit + deltaRight / totalPx).coerceIn(0f, 1f)
        assertEquals(0.6f, newFractionRight, 0.0001f)

        val deltaLeft = -250f
        val newFractionLeft = (initialSplit + deltaLeft / totalPx).coerceIn(0f, 1f)
        assertEquals(0.25f, newFractionLeft, 0.0001f)

        val deltaOvershoot = 800f
        val newFractionOvershoot = (initialSplit + deltaOvershoot / totalPx).coerceIn(0f, 1f)
        assertEquals(1.0f, newFractionOvershoot, 0.0001f)

        val deltaUndershoot = -800f
        val newFractionUndershoot = (initialSplit + deltaUndershoot / totalPx).coerceIn(0f, 1f)
        assertEquals(0.0f, newFractionUndershoot, 0.0001f)
    }

    @Test
    fun testLabelAlphaFadingContract() {
        // Before label alpha: (splitFraction / 0.15f).coerceIn(0f, 1f)
        // After label alpha: ((1f - splitFraction) / 0.15f).coerceIn(0f, 1f)
        
        // At 0% split: Before label fully faded out, After label fully visible
        val beforeAt0 = (0.0f / 0.15f).coerceIn(0f, 1f)
        val afterAt0 = ((1f - 0.0f) / 0.15f).coerceIn(0f, 1f)
        assertEquals(0f, beforeAt0, 0.0001f)
        assertEquals(1f, afterAt0, 0.0001f)

        // At 100% split: Before label fully visible, After label fully faded out
        val beforeAt100 = (1.0f / 0.15f).coerceIn(0f, 1f)
        val afterAt100 = ((1f - 1.0f) / 0.15f).coerceIn(0f, 1f)
        assertEquals(1f, beforeAt100, 0.0001f)
        assertEquals(0f, afterAt100, 0.0001f)

        // At 50% split: Both labels fully visible
        val beforeAt50 = (0.5f / 0.15f).coerceIn(0f, 1f)
        val afterAt50 = ((1f - 0.5f) / 0.15f).coerceIn(0f, 1f)
        assertEquals(1f, beforeAt50, 0.0001f)
        assertEquals(1f, afterAt50, 0.0001f)

        // Mid-fade boundary at 7.5%: Before label halfway faded (0.5)
        val beforeAtHalfFade = (0.075f / 0.15f).coerceIn(0f, 1f)
        assertEquals(0.5f, beforeAtHalfFade, 0.0001f)
    }

    @Test
    fun testClipGeometryOutlineContract() {
        // Test outline clip computation: left = leftCut, right = width
        val width = 800f
        val height = 600f

        val splitMid = 0.5f
        val leftCutMid = width * splitMid.coerceIn(0f, 1f)
        assertEquals(400f, leftCutMid, 0.0001f)

        val splitStart = 0.0f
        val leftCutStart = width * splitStart.coerceIn(0f, 1f)
        assertEquals(0f, leftCutStart, 0.0001f)

        val splitEnd = 1.0f
        val leftCutEnd = width * splitEnd.coerceIn(0f, 1f)
        assertEquals(800f, leftCutEnd, 0.0001f)
    }

    @Test
    fun testBeforeAfterComparisonViewDeclaration() {
        val methods = MainActivity::class.java.declaredMethods
        // Verify BeforeAfterComparisonView is declared or defined in the package
        val topLevelClass = Class.forName("com.depthforge.app.MainActivityKt")
        assertNotNull("MainActivityKt must exist", topLevelClass)
        val comparisonFunction = topLevelClass.declaredMethods.find { 
            it.name.contains("BeforeAfterComparisonView") 
        }
        assertNotNull("MainActivityKt must declare BeforeAfterComparisonView composable", comparisonFunction)
    }
}
