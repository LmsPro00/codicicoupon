# Script di deployment per l'applicazione Lions 2025

Write-Host "=== Script di Deployment Lions 2025 ===" -ForegroundColor Cyan
Write-Host "Preparazione dei file per il deployment..." -ForegroundColor Yellow

# Verifica che tutti i file necessari esistano
if (-not (Test-Path "utils/storage-adapter.js")) {
    Write-Host "Errore: File storage-adapter.js non trovato. Assicurati di aver creato questo file." -ForegroundColor Red
    exit 1
}

Write-Host "Tutti i file necessari sono presenti." -ForegroundColor Green

# Esegui il build dell'applicazione
Write-Host "Esecuzione del build dell'applicazione..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Errore durante il build dell'applicazione." -ForegroundColor Red
    exit 1
}

Write-Host "Build completato con successo!" -ForegroundColor Green

# Esegui il deployment su Netlify
Write-Host "Esecuzione del deployment su Netlify..." -ForegroundColor Yellow
npx netlify deploy --prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "Errore durante il deployment su Netlify." -ForegroundColor Red
    exit 1
}

Write-Host "Deployment completato con successo!" -ForegroundColor Green
Write-Host "L'applicazione è ora online e pronta all'uso." -ForegroundColor Cyan
