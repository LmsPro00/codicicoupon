@echo off
echo === Script per caricare le modifiche su GitHub ===
echo.

cd /d "%~dp0"
echo Directory corrente: %CD%
echo.

echo Aggiunta di tutti i file modificati...
git add .
echo.

echo Creazione del commit...
git commit -m "Risolti conflitti merge e implementato storage adapter"
echo.

echo Tentativo di push normale...
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Push normale fallito, tentativo con force push...
    git push -f origin main
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo Errore durante il push. Verifica manualmente.
        pause
        exit /b 1
    )
)

echo.
echo Push completato con successo!
pause
