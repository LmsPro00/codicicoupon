// Script per testare il webhook di Zapier
const fetch = require('node-fetch');
const AbortController = require('abort-controller');

// Configurazione
const ZAPIER_URL = process.env.ZAPIER_WEBHOOK_URL || 'https://hooks.zapier.com/hooks/catch/your-webhook-id-here';

async function testWebhook() {
  console.log('Inizio test del webhook Zapier...');
  console.log(`URL: ${ZAPIER_URL}`);
  
  try {
    // Implementazione con timeout per evitare attese troppo lunghe
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 secondi di timeout
    
    // Dati di test
    const testData = {
      extracted_codes: ['TEST001', 'TEST002', 'TEST003'],
      timestamp: new Date().toISOString(),
      remaining_count: 42,
      test: true
    };
    
    console.log('Invio dati di test:', JSON.stringify(testData));
    
    const response = await fetch(ZAPIER_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Request-Source': 'lions-2025-test'
      },
      body: JSON.stringify(testData),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId); // Pulisce il timeout se la richiesta è completata
    
    console.log(`Stato risposta: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.error(`Errore nell'invio a Zapier: ${response.status} ${response.statusText}`);
      // Log della risposta per debug
      try {
        const errorText = await response.text();
        console.error('Dettagli errore Zapier:', errorText);
      } catch (e) {
        console.error('Impossibile leggere il corpo della risposta di errore');
      }
    } else {
      const responseData = await response.text();
      console.log('Test completato con successo!');
      console.log('Risposta:', responseData || '(nessuna risposta)');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Timeout durante la connessione a Zapier (5s)');
    } else {
      console.error('Errore durante il test del webhook:', error.message);
    }
  }
}

// Esegui il test
testWebhook();
