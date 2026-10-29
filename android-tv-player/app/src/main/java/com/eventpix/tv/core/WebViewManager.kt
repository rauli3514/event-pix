package com.eventpix.tv.core

import android.annotation.SuppressLint
import android.annotation.TargetApi
import android.content.Context
import android.net.Uri
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.util.Log
import android.view.ViewGroup
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.InputStream

class WebViewManager(
    private val webView: WebView,
    // Script que deja el token del puente (TvBridge) en la página. Se ejecuta
    // solo en el frame principal y solo en páginas nuestras (isTrustedUrl).
    private val bridgeTokenScript: () -> String,
    // Se llama cuando el proceso de render del WebView murió (OOM o crash):
    // la Activity tiene que crear uno nuevo o la pantalla queda en negro.
    private val onRendererGone: () -> Unit
) {

    companion object {
        private const val APP_HOST = "app.event-pix.com.ar"

        // Páginas en las que confiamos: la web de EventPix y las del APK.
        fun isTrustedUrl(url: String?): Boolean {
            if (url.isNullOrEmpty()) return false
            if (url.startsWith("file:///android_asset/")) return true
            val uri = Uri.parse(url)
            return uri.scheme == "https" && uri.host == APP_HOST
        }
    }

    private fun injectBridgeToken(view: WebView?, url: String?) {
        if (view != null && isTrustedUrl(url)) {
            view.evaluateJavascript(bridgeTokenScript(), null)
        }
    }

    // El frame principal no puede salir de nuestras páginas: si no, un iframe
    // podría redirigir toda la TV a otro sitio (top.location) y ese sitio
    // recibiría el token del puente al cargar.
    private fun blockUntrustedNavigation(url: String?): Boolean {
        if (isTrustedUrl(url)) return false
        Log.w("WebViewManager", "Navegación bloqueada fuera de la app: $url")
        return true
    }

    @SuppressLint("SetJavaScriptEnabled")
    fun initializeWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            // Con red: caché normal (respeta los headers), así las TVs toman cada
            // versión nueva de la web. Sin red: lo que haya en caché, para arrancar
            // igual y seguir reproduciendo el último contenido.
            cacheMode = if (isOnline()) WebSettings.LOAD_DEFAULT else WebSettings.LOAD_CACHE_ELSE_NETWORK
            // Optimizations for TV & 60fps GPU CSS Transitions
            useWideViewPort = true
            loadWithOverviewMode = true
        }

        // Enable hardware GPU acceleration layer for smooth 3D CSS transitions
        webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)

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

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                if (request?.isForMainFrame != true) return false
                return blockUntrustedNavigation(request.url?.toString())
            }

            // Android < 7 usa esta variante (solo navegaciones del frame principal).
            @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return blockUntrustedNavigation(url)
            }

            // El token se inyecta en cuanto la página es visible y otra vez al
            // terminar de cargar (por si la primera llegó antes que el JS de la app).
            override fun onPageCommitVisible(view: WebView?, url: String?) {
                super.onPageCommitVisible(view, url)
                injectBridgeToken(view, url)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectBridgeToken(view, url)
            }

            // Android 6+ llama a esta variante (con WebResourceError).
            @TargetApi(Build.VERSION_CODES.M)
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                Log.e("WebViewManager", "Error loading web content: ${error?.description}")
                
                // Si falla la carga del frame principal por estar sin red, cargar fallback local
                if (request?.isForMainFrame == true) loadOfflineFallback(view)
            }

            // Android 5 usa esta otra (solo errores del frame principal): sin
            // ella, sin red mostraba la página de error del navegador.
            @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
            override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                Log.e("WebViewManager", "Error loading web content ($errorCode): $description")
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) loadOfflineFallback(view)
            }

            override fun onRenderProcessGone(view: WebView?, detail: android.webkit.RenderProcessGoneDetail?): Boolean {
                Log.e("WebViewManager", "Render process gone (OOM or crash). Recreating WebView...")
                // Un WebView cuyo renderer murió no se puede volver a usar: sacarlo de la
                // vista, destruirlo y pedirle a la Activity que arme uno nuevo.
                view?.let {
                    (it.parent as? ViewGroup)?.removeView(it)
                    it.destroy()
                }
                onRendererGone()
                return true
            }
        }
    }

    private fun loadOfflineFallback(view: WebView?) {
        if (view?.url?.startsWith("file:///android_asset/") == true) return
        Log.d("WebViewManager", "Main frame load failed offline. Loading local asset offline_boot.html...")
        view?.loadUrl("file:///android_asset/offline_boot.html")
    }

    private fun isOnline(): Boolean {
        return try {
            val cm = webView.context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val capabilities = cm.getNetworkCapabilities(cm.activeNetwork)
                capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
            } else {
                @Suppress("DEPRECATION")
                cm.activeNetworkInfo?.isConnected == true
            }
        } catch (e: Exception) {
            false
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
