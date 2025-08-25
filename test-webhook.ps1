# Script PowerShell per testare il webhook di Zapier

# Verifica se esiste la variabile d'ambiente ZAPIER_WEBHOOK_URL
$zapierUrl = $env:ZAPIER_WEBHOOK_URL
if (-not $zapierUrl) {
    Write-Host "ATTENZIONE: La variabile d'ambiente ZAPIER_WEBHOOK_URL non è impostata."
    $zapierUrl = Read-Host "Inserisci l'URL del webhook Zapier"
}

Write-Host "Inizio test del webhook Zapier..."
Write-Host "URL: $zapierUrl"

# Dati di test
$testData = @{
    extracted_codes = @("TEST001", "TEST002", "TEST003")
    timestamp = (Get-Date).ToString("o")
    remaining_count = 42
    test = $true
}

$jsonData = ConvertTo-Json $testData
Write-Host "Invio dati di test: $jsonData"

try {
    $headers = @{
        "Content-Type" = "application/json"
        "X-Request-Source" = "lions-2025-test"
    }
    
    # Imposta un timeout di 5 secondi
    $response = Invoke-WebRequest -Uri $zapierUrl -Method Post -Body $jsonData -Headers $headers -TimeoutSec 5
    
    Write-Host "Stato risposta: $($response.StatusCode) $($response.StatusDescription)"
    
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        Write-Host "Test completato con successo!"
        Write-Host "Risposta: $($response.Content)"
    }
    else {
        Write-Host "Errore nell'invio a Zapier: $($response.StatusCode) $($response.StatusDescription)"
        Write-Host "Dettagli errore Zapier: $($response.Content)"
    }
}
catch {
    if ($_.Exception.Message -like "*timeout*") {
        Write-Host "Timeout durante la connessione a Zapier (5s)" -ForegroundColor Red
    }
    else {
        Write-Host "Errore durante il test del webhook: $($_.Exception.Message)" -ForegroundColor Red
    }
}
