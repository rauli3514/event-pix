package com.eventpix.tv.core

import android.annotation.SuppressLint
import android.util.Log
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.InputStream

class WebViewManager(private val webView: WebView) {

    @SuppressLint("SetJavaScriptEnabled")
    fun initializeWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            // Optimizations for TV
            useWideViewPort = true
            loadWithOverviewMode = true
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val url = request.url.toString()
                
                // Interceptar únicamente los archivos pesados (logo, fondos, animaciones)
                if (url.contains("/edm-assets/")) {
                    try {
                        val fileName = url.substringAfter("/edm-assets/")
                        val assetPath = "edm-assets/$fileName"
                        
                        val mimeType = when {
                            fileName.endsWith(".png", ignoreCase = true) -> "image/png"
                            fileName.endsWith(".mp4", ignoreCase = true) -> "video/mp4"
                            fileName.endsWith(".jpg", ignoreCase = true) || fileName.endsWith(".jpeg", ignoreCase = true) -> "image/jpeg"
                            else -> "application/octet-stream"
                        }
                        
                        val inputStream: InputStream = view.context.assets.open(assetPath)
                        Log.d("WebViewManager", "Served local asset: $assetPath")
                        return WebResourceResponse(mimeType, "UTF-8", inputStream)
                    } catch (e: Exception) {
                        Log.e("WebViewManager", "Failed to load local asset: $url", e)
                    }
                }
                
                return super.shouldInterceptRequest(view, request)
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                Log.e("WebViewManager", "Error loading web content: ${error?.description}")
            }

            override fun onRenderProcessGone(view: WebView?, detail: android.webkit.RenderProcessGoneDetail?): Boolean {
                Log.e("WebViewManager", "Render process gone (OOM or crash). Reloading WebView...")
                view?.destroy()
                // Let the activity handle the recreation if needed, or we just return true to prevent app crash
                return true
            }
        }
    }

    fun loadUrl(url: String) {
        Log.d("WebViewManager", "Loading URL: $url")
        webView.loadUrl(url)
    }
    
    fun reload() {
        webView.reload()
    }
    
    fun clearCache() {
        webView.clearCache(true)
    }
}
