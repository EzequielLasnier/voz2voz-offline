@echo off
setlocal

:: 1. Iniciar Ollama en segundo plano
echo [INFO] Verificando motor Ollama...
tasklist /FI "IMAGENAME eq ollama app.exe" 2>NUL | find /I /N "ollama app.exe">NUL
if "%ERRORLEVEL%"=="1" (
    start "" /B "C:\Users\%USERNAME%\AppData\Local\Programs\Ollama\ollama app.exe"
    timeout /t 3 /nobreak > NUL
)

:: 2. Crear y ejecutar el script invisible con rutas seguras
echo [OK] Iniciando Motores de Voz y Traducción...
set CONDA_BAT=C:\ProgramData\anaconda3\condabin\conda.bat
set SCRIPT_VBS="%TEMP%\run_voz2voz_%RANDOM%.vbs"

echo Set WshShell = CreateObject("WScript.Shell") > %SCRIPT_VBS%
echo WshShell.Run "cmd /c call ""%CONDA_BAT%"" activate voz2voz-env && cd /d ""%~dp0backend"" && python app/main.py", 0, false >> %SCRIPT_VBS%

:: Ejecutar desde la carpeta temporal para evitar bloqueos
wscript.exe %SCRIPT_VBS%

:: 3. Espera estratégica para carga de modelos (Whisper + Qwen)
echo [OK] Cargando modelos de IA en segundo plano...
timeout /t 12 /nobreak > NUL

:: 4. Abrir la interfaz y limpiar rastro
start http://localhost:8000
timeout /t 2 /nobreak > NUL
del %SCRIPT_VBS%
exit