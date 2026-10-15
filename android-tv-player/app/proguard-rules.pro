# Reglas de R8 para la compilación release (isMinifyEnabled = true).

# Puente con la web: R8 no puede ver que JavaScript llama a estos métodos.
# (Las reglas por defecto ya conservan @JavascriptInterface; se repite por las dudas.)
-keepclassmembers class com.eventpix.tv.core.TvBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface

# Receivers declarados en el manifest.
-keep class com.eventpix.tv.core.BootReceiver
-keep class com.eventpix.tv.core.AppRestartReceiver
