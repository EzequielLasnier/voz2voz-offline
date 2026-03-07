@echo off
cd /d "%~dp0"

echo ==========================================
echo    VOZ2VOZ OFFLINE - INICIO DIRECTO
echo ==========================================

:: 1. Activar Conda
set CONDA_BAT=C:\ProgramData\anaconda3\condabin\conda.bat
echo [OK] Activando entorno: voz2voz-env...
call "%CONDA_BAT%" activate voz2voz-env

:: 2. Lanzar Interfaz
echo [OK] Abriendo navegador...
start http://localhost:8000

:: 3. Ejecutar Servidor (Cambiando a la carpeta backend)
echo [OK] Iniciando servidor FastAPI...
cd backend
python app/main.py

pause