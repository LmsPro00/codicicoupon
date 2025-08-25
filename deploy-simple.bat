@echo off
echo === Script di Deployment Semplificato ===
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

echo Installazione di netlify-cli...
call npm install netlify-cli --no-save
if %ERRORLEVEL% NEQ 0 (
    echo Errore durante l'installazione di netlify-cli.
    echo Procedere con il deployment manuale.
    goto manual
)

echo.
echo Tentativo di deployment su Netlify...
call npx netlify deploy --prod --dir=.next
if %ERRORLEVEL% NEQ 0 (
    echo Errore durante il deployment su Netlify.
    echo Procedere con il deployment manuale.
    goto manual
)

echo.
echo Deployment completato con successo!
echo L'applicazione è ora online e pronta all'uso.
pause
exit /b 0

:manual
echo.
echo Istruzioni per il deployment manuale:
echo 1. Accedi a https://app.netlify.com/
echo 2. Clicca su "Add new site" e seleziona "Deploy manually"
echo 3. Trascina la cartella ".next" nella zona di drop
echo 4. Configura le seguenti variabili d'ambiente nelle impostazioni del sito:
echo    - ZAPIER_WEBHOOK_URL: URL del webhook Zapier
echo    - NUM_EXTRACT: 15 (o il numero di codici da estrarre)
echo    - REDIS_URL: URL del tuo server Redis (se disponibile in produzione)
echo.
echo Apertura del browser su Netlify...
start https://app.netlify.com/
echo.
pause
