#!/bin/bash
# build-mobile-apk.sh
# Genera el APK de EventPix para CELULAR Android
# - Login → panel admin (misma web)
# - Bluetooth cliente para configurar el Tanix
# - Pantalla normal (portrait/landscape auto)
#
# Uso: chmod +x build-mobile-apk.sh && ./build-mobile-apk.sh

set -e

echo ""
echo "═══════════════════════════════════════════════════"
echo "  EventPix — Build APK Celular (Mobile)"
echo "═══════════════════════════════════════════════════"
echo ""

# 1. Build web con flavor=mobile
echo "▶ 1/4 Compilando app web (modo MOBILE)..."
VITE_APP_FLAVOR=mobile npm run build

echo ""
echo "▶ 2/4 Sincronizando con Android (npx cap sync)..."
npx cap sync android

echo ""
echo "▶ 3/4 Limpiando assets pesados innecesarios..."
# Quitar carpetas de demo/temas que pesan mucho pero no se usan en runtime
ASSETS_DIR="android/app/src/main/assets/public"
rm -rf "$ASSETS_DIR/themes" 2>/dev/null || true
rm -rf "$ASSETS_DIR/edm-assets" 2>/dev/null || true
rm -rf "$ASSETS_DIR/figuritas" 2>/dev/null || true
find "$ASSETS_DIR" -name "*.mp4" -delete 2>/dev/null || true

# Limpiar archivos con espacios que rompen Gradle
find android -name "* *" -exec rm -rf {} + 2>/dev/null || true

echo ""
echo "▶ 4/4 Compilando APK Android (debug)..."
cd android
./gradlew assembleDebug --no-daemon 2>&1 | tail -20
cd ..

echo ""
APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
  SIZE=$(du -sh "$APK_PATH" | cut -f1)
  # Copiar con nombre descriptivo
  cp "$APK_PATH" "android/app/build/outputs/apk/debug/eventpix-mobile.apk"
  echo "═══════════════════════════════════════════════════"
  echo "  ✅ BUILD EXITOSO"
  echo "  📦 Tamaño: $SIZE"
  echo "  📍 APK:  android/app/build/outputs/apk/debug/eventpix-mobile.apk"
  echo "═══════════════════════════════════════════════════"
else
  echo "❌ Error: No se encontró el APK"
  exit 1
fi
