@echo off
echo === Script per il Deployment su Netlify ===
echo.

cd /d "%~dp0"
echo Directory corrente: %CD%
echo.

echo Esecuzione del build dell'applicazione...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo Errore durante il build dell'applicazione.
    pause
    exit /b 1
)

echo.
echo Build completato con successo!
echo.
echo Per completare il deployment su Netlify:
echo 1. Accedi a https://app.netlify.com/
echo 2. Clicca su "Add new site" e seleziona "Deploy manually"
echo 3. Trascina la cartella ".next" nella zona di drop
echo 4. Configura le seguenti variabili d'ambiente nelle impostazioni del sito:
echo    - ZAPIER_WEBHOOK_URL: URL del webhook Zapier
echo    - NUM_EXTRACT: 15 (o il numero di codici da estrarre)
echo    - REDIS_URL: URL del tuo server Redis (se disponibile in produzione)
echo.
echo Premi un tasto per aprire la dashboard di Netlify...
pause
start https://app.netlify.com/
echo.
pause
