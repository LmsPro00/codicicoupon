# Script per il deployment dell'applicazione con opzioni verbose e gestione errori avanzata

# Abilita la modalità verbose
$VerbosePreference = "Continue"
$ErrorActionPreference = "Stop"

Write-Host "=== Script di Deployment Avanzato ===" -ForegroundColor Magenta
Write-Host "Directory corrente: $PWD" -ForegroundColor Yellow

# Verifica che tutti i file necessari esistano
$requiredFiles = @(
    "utils/storage-adapter.js",
    "pages/api/extract-codes.js",
    "pages/api/reset-codes.js",
    "scripts/init-kv-storage.js"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    Write-Verbose "Verificando esistenza del file: $file"
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "Errore: I seguenti file necessari non esistono:" -ForegroundColor Red
    $missingFiles | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
    Write-Host "Il deployment non può continuare." -ForegroundColor Red
    exit 1
}

Write-Host "Tutti i file necessari sono presenti." -ForegroundColor Green

# Verifica che Node.js e npm siano installati
try {
    $nodeVersion = node -v
    $npmVersion = npm -v
    Write-Host "Node.js: $nodeVersion" -ForegroundColor Green
    Write-Host "npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "Errore: Node.js o npm non sono installati correttamente." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Verifica che le dipendenze siano installate
Write-Host "Verifica delle dipendenze..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules")) {
    Write-Host "Installazione delle dipendenze..." -ForegroundColor Yellow
    npm install --verbose
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Errore durante l'installazione delle dipendenze." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Le dipendenze sono già installate." -ForegroundColor Green
}

# Esegui il build dell'applicazione
Write-Host "Esecuzione del build dell'applicazione..." -ForegroundColor Cyan
npm run build --verbose

if ($LASTEXITCODE -ne 0) {
    Write-Host "Errore durante il build dell'applicazione." -ForegroundColor Red
    exit 1
}

Write-Host "Build completato con successo!" -ForegroundColor Green

# Verifica se Netlify CLI è installato
$netlifyInstalled = $false
try {
    $netlifyVersion = netlify -v
    $netlifyInstalled = $true
    Write-Host "Netlify CLI: $netlifyVersion" -ForegroundColor Green
} catch {
    Write-Host "Netlify CLI non è installato. Installazione in corso..." -ForegroundColor Yellow
    npm install -g netlify-cli --verbose
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Errore durante l'installazione di Netlify CLI." -ForegroundColor Red
        Write-Host "Proveremo a procedere con il deployment manuale." -ForegroundColor Yellow
    } else {
        $netlifyInstalled = $true
        Write-Host "Netlify CLI installato con successo." -ForegroundColor Green
    }
}

# Esegui il deployment su Netlify
if ($netlifyInstalled) {
    Write-Host "Deployment su Netlify..." -ForegroundColor Cyan
    netlify deploy --prod --dir=.next --verbose
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Errore durante il deployment su Netlify." -ForegroundColor Red
        Write-Host "Proveremo a procedere con il deployment manuale." -ForegroundColor Yellow
    } else {
        Write-Host "Deployment su Netlify completato con successo!" -ForegroundColor Green
        exit 0
    }
}

# Se siamo arrivati qui, il deployment automatico non è riuscito
# Forniamo istruzioni per il deployment manuale
Write-Host "\nIstruzioni per il deployment manuale:" -ForegroundColor Yellow
Write-Host "1. Accedi a https://app.netlify.com/" -ForegroundColor White
Write-Host "2. Clicca su 'Add new site' e seleziona 'Deploy manually'" -ForegroundColor White
Write-Host "3. Trascina la cartella '.next' nella zona di drop" -ForegroundColor White
Write-Host "4. Configura le seguenti variabili d'ambiente nelle impostazioni del sito:" -ForegroundColor White
Write-Host "   - ZAPIER_WEBHOOK_URL: URL del webhook Zapier" -ForegroundColor White
Write-Host "   - NUM_EXTRACT: 15 (o il numero di codici da estrarre)" -ForegroundColor White
Write-Host "   - REDIS_URL: URL del tuo server Redis (se disponibile in produzione)" -ForegroundColor White

# Apri automaticamente il browser su Netlify
Write-Host "\nApertura del browser su Netlify..." -ForegroundColor Cyan
Start-Process "https://app.netlify.com/"

Write-Host "\nScript di deployment completato." -ForegroundColor Magenta

if ($LASTEXITCODE -ne 0) {
    Write-Host "Errore durante il deployment su Netlify." -ForegroundColor Red
    exit 1
}
Write-Host "Deployment completato con successo!" -ForegroundColor Green
Write-Host "L'applicazione è ora online e pronta all'uso." -ForegroundColor Cyan
