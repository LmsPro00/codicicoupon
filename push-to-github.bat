@echo off
echo === Script per caricare le modifiche su GitHub ===
echo.

cd /d "%~dp0"
echo Directory corrente: %CD%
echo.

echo Sincronizzazione con il repository remoto...
git pull origin main
echo.

echo Aggiunta dei file modificati...
git add utils/storage-adapter.js
git add pages/api/extract-codes.js
git add pages/api/reset-codes.js
git add scripts/init-kv-storage.js
git add README.md
git add deploy.ps1

echo.
echo Creazione del commit...
git commit -m "Implementato storage adapter con fallback in-memory"

echo.
echo Push al repository remoto...
git push origin main

echo.
echo Operazione completata!
pause
