package com.eventpix.tv.core

import android.annotation.SuppressLint
import android.util.Log
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

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
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                Log.e("WebViewManager", "Error loading web content: ${error?.description}")
                // TODO: Watchdog should detect this and retry
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
