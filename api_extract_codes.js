const fs = require('fs').promises;
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const fetch = require('node-fetch');
const dotenv = require('dotenv');

// Carica le variabili d'ambiente dal file .env
dotenv.config();

// Configurazione
const CSV_PATH = process.env.CSV_PATH || path.join(process.cwd(), 'data', 'codici.csv');
const ZAPIER_URL = process.env.ZAPIER_WEBHOOK_URL;
const N_EXTRACT = parseInt(process.env.NUM_EXTRACT, 10) || 15;

/**
 * Estrae codici random unici dal CSV e li invia a Zapier
 */
async function extractAndSendCodes() {
  try {
    console.log(`🔍 Estrazione di ${N_EXTRACT} codici dal file ${CSV_PATH}...`);
    
    // Verifica che l'URL di Zapier sia configurato
    if (!ZAPIER_URL) {
      throw new Error('ZAPIER_WEBHOOK_URL non configurato nelle variabili d\'ambiente');
    }
    
    // 1) Leggi il CSV dal filesystem
    console.log('📂 Lettura del file CSV...');
    const csvText = await fs.readFile(CSV_PATH, 'utf-8');

    // 2) Parsifica e raccogli tutti i codici non vuoti
    const records = parse(csvText, { skip_empty_lines: false });
    const flat = records.flat().map(cell => (cell || '').trim());
    const allCodes = flat.filter(c => c !== '');
    
    if (!allCodes.length) {
      console.log('⚠️ Nessun codice disponibile nel CSV');
      return { message: 'Nessun codice disponibile' };
    }

    // 3) Estrai codici unici
    const n = Math.min(N_EXTRACT, allCodes.length);
    const selected = [];
    const pool = [...allCodes];
    
    while (selected.length < n) {
      const idx = Math.floor(Math.random() * pool.length);
      selected.push(pool.splice(idx, 1)[0]);
    }

    console.log(`✅ Estratti ${selected.length} codici unici`);
    
    // 4) Invia a Zapier
    console.log(`📤 Invio a Zapier...`);
    const response = await fetch(ZAPIER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        extracted_codes: selected, 
        timestamp: new Date().toISOString() 
      })
    });
    
    if (!response.ok) {
      throw new Error(`Errore nell'invio a Zapier: ${response.statusText}`);
    }
    
    console.log('✅ Codici inviati con successo a Zapier');

    // 5) Aggiorna il CSV locale rimuovendo i codici estratti
    console.log('📝 Aggiornamento del CSV...');
    const updated = records.map(row => 
      row.map(cell => selected.includes((cell||'').trim()) ? '' : cell)
    );
    const newCsv = stringify(updated);
    await fs.writeFile(CSV_PATH, newCsv, 'utf-8');
    
    console.log('✅ File CSV aggiornato');
    
    // 6) Stampa risultati
    console.log('\n📋 RIEPILOGO:');
    console.log(`- Codici estratti: ${selected.length}`);
    console.log(`- Codici rimanenti: ${allCodes.length - n}`);
    console.log('\nCodici estratti:');
    console.log(selected.join('\n'));
    
    return { 
      extracted: selected, 
      remaining: allCodes.length - n 
    };
  } catch (err) {
    console.error('❌ ERRORE:', err.message);
    throw err;
  }
}

// Esegui la funzione se il file è stato chiamato direttamente
if (require.main === module) {
  extractAndSendCodes()
    .then(() => {
      console.log('✨ Operazione completata con successo');
    })
    .catch(err => {
      console.error('❌ Operazione fallita:', err);
      process.exit(1);
    });
} else {
  // Esporta per l'uso come modulo
  module.exports = { extractAndSendCodes };
}
