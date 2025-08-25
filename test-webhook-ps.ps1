# Script PowerShell per testare il webhook di Zapier

# Imposta qui l'URL del webhook Zapier
$webhookUrl = "https://hooks.zapier.com/hooks/catch/your-webhook-id-here"

# Chiedi all'utente di inserire l'URL se non è già impostato
if ($webhookUrl -eq "https://hooks.zapier.com/hooks/catch/your-webhook-id-here") {
    Write-Host "Per favore inserisci l'URL completo del webhook Zapier:" -ForegroundColor Yellow
    $webhookUrl = Read-Host
}

Write-Host "Inizio test del webhook Zapier..." -ForegroundColor Cyan
Write-Host "URL: $webhookUrl" -ForegroundColor Cyan

# Dati di test
$testData = @{
    extracted_codes = @("TEST001", "TEST002", "TEST003")
    timestamp = (Get-Date).ToString("o")
    remaining_count = 42
    test = $true
}

$jsonData = ConvertTo-Json $testData
Write-Host "Invio dati di test: $jsonData" -ForegroundColor Cyan

try {
    $headers = @{
        "Content-Type" = "application/json"
        "X-Request-Source" = "lions-2025-test"
    }
    
    Write-Host "Invio richiesta in corso..." -ForegroundColor Cyan
    
    # Imposta un timeout di 10 secondi
    $response = Invoke-WebRequest -Uri $webhookUrl -Method Post -Body $jsonData -Headers $headers -TimeoutSec 10 -UseBasicParsing
    
    Write-Host "Stato risposta: $($response.StatusCode) $($response.StatusDescription)" -ForegroundColor Green
    
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        Write-Host "Test completato con successo!" -ForegroundColor Green
        Write-Host "Risposta: $($response.Content)" -ForegroundColor Green
    }
    else {
        Write-Host "Errore nell'invio a Zapier: $($response.StatusCode) $($response.StatusDescription)" -ForegroundColor Red
        Write-Host "Dettagli errore Zapier: $($response.Content)" -ForegroundColor Red
    }
}
catch {
    if ($_.Exception.Message -like "*timeout*") {
        Write-Host "Timeout durante la connessione a Zapier (10s)" -ForegroundColor Red
        Write-Host "Possibili cause: URL non valido, problemi di rete, o Zapier non risponde" -ForegroundColor Red
    }
    elseif ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "ERRORE 404: Il webhook non esiste o è stato eliminato" -ForegroundColor Red
        Write-Host "Verifica che l'URL sia corretto e che lo Zap sia attivo su Zapier" -ForegroundColor Red
    }
    elseif ($_.Exception.Response.StatusCode -eq 429) {
        Write-Host "ERRORE 429: Hai raggiunto il limite di richieste di Zapier" -ForegroundColor Red
        Write-Host "Attendi qualche minuto e riprova" -ForegroundColor Red
    }
    else {
        Write-Host "Errore durante il test del webhook: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            Write-Host "Codice di stato: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        }
    }
}

Write-Host "`nSUGGERIMENTI:" -ForegroundColor Yellow
Write-Host "1. Verifica che l'URL del webhook sia corretto" -ForegroundColor Yellow
Write-Host "2. Controlla che lo Zap sia attivo su Zapier" -ForegroundColor Yellow
Write-Host "3. Se lo Zap è stato ricreato, aggiorna l'URL nel file .env" -ForegroundColor Yellow
Write-Host "4. Verifica di non aver superato i limiti del tuo piano Zapier" -ForegroundColor Yellow

Write-Host "`nPremi un tasto per chiudere..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
