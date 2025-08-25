// Script semplice per testare il webhook di Zapier
const https = require('https');

// URL del webhook (sostituisci con il tuo URL reale)
const webhookUrl = 'https://hooks.zapier.com/hooks/catch/your-webhook-id-here';

// Dati di test
const testData = {
  extracted_codes: ['TEST001', 'TEST002', 'TEST003'],
  timestamp: new Date().toISOString(),
  remaining_count: 42,
  test: true
};

console.log('Inizio test del webhook Zapier...');
console.log(`URL: ${webhookUrl}`);
console.log('Dati di test:', JSON.stringify(testData));

// Prepara i dati per l'invio
const postData = JSON.stringify(testData);

// Estrai l'hostname e il path dall'URL
const url = new URL(webhookUrl);

// Opzioni per la richiesta
const options = {
  hostname: url.hostname,
  port: 443,
  path: url.pathname + url.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'X-Request-Source': 'lions-2025-test'
  }
};

// Crea la richiesta
const req = https.request(options, (res) => {
  console.log(`Stato risposta: ${res.statusCode} ${res.statusMessage}`);
  
  let responseData = '';
  
  // Raccolta dei dati di risposta
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  // Completamento della risposta
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('Test completato con successo!');
      console.log('Risposta:', responseData || '(nessuna risposta)');
    } else {
      console.error(`Errore nell'invio a Zapier: ${res.statusCode}`);
      console.error('Dettagli errore:', responseData);
    }
  });
});

// Gestione degli errori
req.on('error', (e) => {
  console.error(`Errore durante la richiesta: ${e.message}`);
});

// Imposta un timeout
req.setTimeout(5000, () => {
  console.error('Timeout durante la connessione a Zapier (5s)');
  req.destroy();
});

// Invia i dati
req.write(postData);
req.end();

console.log('Richiesta inviata, in attesa di risposta...');
