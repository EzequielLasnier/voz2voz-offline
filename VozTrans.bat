@echo off
setlocal

echo ==========================================
echo    VOZ2VOZ OFFLINE - INICIO DIRECTO
echo ==========================================

:: 1. Iniciar Ollama en segundo plano (Si no está corriendo)
tasklist /FI "IMAGENAME eq ollama app.exe" 2>NUL | find /I /N "ollama app.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo [INFO] Iniciando motor Ollama...
    start "" /B "C:\Users\%USERNAME%\AppData\Local\Programs\Ollama\ollama app.exe"
    timeout /t 5 /nobreak > NUL
)

:: 2. Activar Entorno y Ejecutar Servidor en modo oculto
set CONDA_BAT=C:\ProgramData\anaconda3\condabin\conda.bat
echo [OK] Iniciando Motores de Voz y Traducción...

:: Usamos un pequeño script VBScript temporal para lanzar sin ventana de consola
echo Set WshShell = CreateObject("WScript.Shell") > run_hidden.vbs
echo WshShell.Run "cmd /c call ""%CONDA_BAT%"" activate voz2voz-env && cd backend && python app/main.py", 0, false >> run_hidden.vbs
wscript.exe run_hidden.vbs
del run_hidden.vbs

:: 3. Esperar a que el modelo cargue antes de abrir el navegador
echo [OK] Cargando modelos de IA (Whisper + Qwen)...
timeout /t 15 /nobreak > NUL

:: 4. Abrir la interfaz (Última tarea)
start http://localhost:8000
exit