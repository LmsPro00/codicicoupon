@echo off
echo === Script per Testare l'Applicazione ===
echo.

cd /d "%~dp0"
echo Directory corrente: %CD%
echo.

echo Avvio del server di sviluppo...
echo (Premi Ctrl+C per terminare il server quando hai finito)
echo.
npm run dev
