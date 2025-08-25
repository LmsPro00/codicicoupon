// Script avanzato per testare il webhook di Zapier con diagnostica dettagliata
const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const https = require('https');
const dns = require('dns');
const { promisify } = require('util');
const dotenv = require('dotenv');

// Carica le variabili d'ambiente
dotenv.config();

// Configurazione
const ZAPIER_URL = process.env.ZAPIER_WEBHOOK_URL || 'https://hooks.zapier.com/hooks/catch/your-webhook-id-here';
const TIMEOUT_MS = 10000; // 10 secondi di timeout

// Funzione per verificare la risoluzione DNS
async function checkDns(hostname) {
  try {
    console.log(`\n🔍 Verifica DNS per ${hostname}...`);
    const lookup = promisify(dns.lookup);
    const result = await lookup(hostname);
    console.log(`✅ DNS risolto: ${hostname} -> ${result.address}`);
    return true;
  } catch (error) {
    console.error(`❌ Errore DNS: ${error.message}`);
    return false;
  }
}

// Funzione per testare la connettività di base
async function testConnectivity(url) {
  try {
    const urlObj = new URL(url);
    console.log(`\n🔌 Test di connettività per ${urlObj.hostname}...`);
    
    // Verifica DNS
    const dnsOk = await checkDns(urlObj.hostname);
    if (!dnsOk) {
      console.error('❌ Impossibile risolvere il nome host. Verifica la connessione internet o il DNS.');
      return false;
    }
    
    // Test di connessione HTTPS
    return new Promise((resolve) => {
      console.log(`🔒 Test connessione HTTPS a ${urlObj.hostname}:${urlObj.port || 443}...`);
      const req = https.request({
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: '/',
        method: 'HEAD',
        timeout: 5000
      }, (res) => {
        console.log(`✅ Connessione HTTPS stabilita: ${res.statusCode} ${res.statusMessage}`);
        resolve(true);
      });
      
      req.on('error', (error) => {
        console.error(`❌ Errore di connessione HTTPS: ${error.message}`);
        resolve(false);
      });
      
      req.on('timeout', () => {
        console.error('❌ Timeout durante il test di connessione HTTPS');
        req.destroy();
        resolve(false);
      });
      
      req.end();
    });
  } catch (error) {
    console.error(`❌ Errore durante il test di connettività: ${error.message}`);
    return false;
  }
}

// Funzione per testare il webhook con diagnostica avanzata
async function testWebhookAdvanced() {
  console.log('🚀 Inizio test avanzato del webhook Zapier...');
  console.log(`🔗 URL: ${ZAPIER_URL}`);
  
  try {
    // Verifica che l'URL sia valido
    if (!ZAPIER_URL || !ZAPIER_URL.startsWith('https://hooks.zapier.com')) {
      throw new Error('URL del webhook non valido o non configurato correttamente');
    }
    
    const urlObj = new URL(ZAPIER_URL);
    
    // Test di connettività di base
    const connectivityOk = await testConnectivity(ZAPIER_URL);
    if (!connectivityOk) {
      console.error('⚠️ Test di connettività fallito. Il problema potrebbe essere di rete.');
      return;
    }
    
    // Implementazione con timeout per evitare attese troppo lunghe
    console.log(`\n📤 Invio richiesta al webhook con timeout di ${TIMEOUT_MS/1000}s...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    // Dati di test con identificatore univoco
    const testId = `test-${Date.now()}`;
    const testData = {
      extracted_codes: ['TEST001', 'TEST002', 'TEST003'],
      timestamp: new Date().toISOString(),
      remaining_count: 42,
      test_id: testId,
      source: 'advanced-diagnostic-tool'
    };
    
    console.log('📦 Dati di test:', JSON.stringify(testData, null, 2));
    
    // Invia la richiesta con headers dettagliati
    const startTime = Date.now();
    const response = await fetch(ZAPIER_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Request-Source': 'lions-2025-diagnostic',
        'User-Agent': 'Lions2025-DiagnosticTool/1.0',
        'X-Test-ID': testId
      },
      body: JSON.stringify(testData),
      signal: controller.signal
    });
    
    const endTime = Date.now();
    clearTimeout(timeoutId); // Pulisce il timeout se la richiesta è completata
    
    console.log(`\n⏱️ Tempo di risposta: ${endTime - startTime}ms`);
    console.log(`📊 Stato risposta: ${response.status} ${response.statusText}`);
    console.log(`🔍 Headers risposta:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      console.error(`❌ Errore nell'invio a Zapier: ${response.status} ${response.statusText}`);
      
      // Log della risposta per debug
      try {
        const errorText = await response.text();
        console.error('📄 Dettagli errore Zapier:', errorText);
        
        // Analisi dell'errore
        if (response.status === 429) {
          console.error('⚠️ ERRORE 429: Hai raggiunto il limite di richieste di Zapier. Attendi e riprova più tardi.');
        } else if (response.status === 404) {
          console.error('⚠️ ERRORE 404: Il webhook non esiste o è stato eliminato. Verifica l\'URL su Zapier.');
        } else if (response.status === 403) {
          console.error('⚠️ ERRORE 403: Accesso negato. Il webhook potrebbe essere stato disabilitato.');
        } else if (response.status >= 500) {
          console.error('⚠️ ERRORE SERVER: Problema sui server di Zapier. Riprova più tardi.');
        }
      } catch (e) {
        console.error('❌ Impossibile leggere il corpo della risposta di errore');
      }
    } else {
      const responseData = await response.text();
      console.log('✅ Test completato con successo!');
      console.log('📄 Risposta:', responseData || '(nessuna risposta)');
      console.log('\n🎉 Il webhook sembra funzionare correttamente!');
    }
    
    // Suggerimenti in base ai risultati
    console.log('\n📋 SUGGERIMENTI:');
    if (response.ok) {
      console.log('- Il webhook è raggiungibile e risponde correttamente');
      console.log('- Se l\'app non funziona, verifica che lo Zap sia attivato su Zapier');
      console.log('- Controlla che lo Zap stia elaborando correttamente i dati ricevuti');
    } else {
      console.log('- Verifica che l\'URL del webhook sia corretto e aggiornato');
      console.log('- Controlla che lo Zap sia attivo su Zapier');
      console.log('- Verifica di non aver superato i limiti del tuo piano Zapier');
      console.log('- Prova a ricreare lo Zap e ottenere un nuovo URL webhook');
    }
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`❌ TIMEOUT: La richiesta è stata interrotta dopo ${TIMEOUT_MS/1000}s`);
      console.error('⚠️ Possibili cause: problemi di rete, server Zapier non risponde, o URL non valido');
    } else {
      console.error(`❌ ERRORE: ${error.message}`);
      console.error('Stack trace:', error.stack);
    }
    
    console.log('\n📋 SUGGERIMENTI PER RISOLVERE:');
    console.log('1. Verifica la tua connessione internet');
    console.log('2. Controlla che l\'URL del webhook sia corretto');
    console.log('3. Accedi a Zapier e verifica che lo Zap sia attivo');
    console.log('4. Prova a ricreare lo Zap per ottenere un nuovo URL webhook');
    console.log('5. Verifica di non aver superato i limiti del tuo piano Zapier');
  }
}

// Esegui il test
testWebhookAdvanced();
