package com.eventpix.tv.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// Rangos de bytes que pide el reproductor de video del WebView.
class MediaCacheRangeTest {
    private val total = 1000L

    @Test fun rangoCompleto() = assertEquals(0L to 999L, MediaCache.parseRange("bytes=0-", total))
    @Test fun rangoConFin() = assertEquals(100L to 199L, MediaCache.parseRange("bytes=100-199", total))
    @Test fun finMasAllaDelArchivo() = assertEquals(900L to 999L, MediaCache.parseRange("bytes=900-5000", total))
    @Test fun ultimosBytes() = assertEquals(800L to 999L, MediaCache.parseRange("bytes=-200", total))
    @Test fun ultimosBytesMasQueElArchivo() = assertEquals(0L to 999L, MediaCache.parseRange("bytes=-5000", total))
    @Test fun soloElPrimerRango() = assertEquals(0L to 9L, MediaCache.parseRange("bytes=0-9, 20-29", total))
    @Test fun inicioFueraDelArchivo() = assertNull(MediaCache.parseRange("bytes=1000-", total))
    @Test fun inicioMayorQueFin() = assertNull(MediaCache.parseRange("bytes=50-10", total))
    @Test fun basura() = assertNull(MediaCache.parseRange("bytes=abc", total))
    @Test fun archivoVacio() = assertNull(MediaCache.parseRange("bytes=0-", 0))
}
