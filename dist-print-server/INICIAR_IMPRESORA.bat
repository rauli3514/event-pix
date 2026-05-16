@echo off
TITLE SERVIDOR DE IMPRESION EVENTPIX
echo =============================================
echo   INSTALANDO / INICIANDO SERVIDOR...
echo =============================================
echo.

:: Verificar si Node.js esta instalado
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado. 
    echo Por favor instala Node.js desde https://nodejs.org/ antes de continuar.
    pause
    exit
)

:: Instalar dependencias si no existen
if not exist node_modules (
    echo Instalando componentes necesarios...
    call npm install
)

:: Iniciar el servidor
echo Servidor iniciando...
node server.js

pause
