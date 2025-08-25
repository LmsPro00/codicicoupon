const fs = require('fs').promises;
const path = require('path');
const { parse } = require('csv-parse/sync');

// Importa il nostro storage adapter
const { createStorageClient } = require('../utils/storage-adapter');

// Configurazione
const CSV_PATH = process.argv[2] || path.join(process.cwd(), 'data', 'codici.csv');
const CSV_KEY = 'lions_codes';

// Inizializza il client di storage (Redis o in-memory fallback)
const kv = createStorageClient();

async function initializeCodesFromFile() {
  try {
    console.log(`📂 Lettura del file CSV: ${CSV_PATH}...`);
    
    // Leggi il file CSV
    const csvText = await fs.readFile(CSV_PATH, 'utf-8');
    
    // Parsifica il CSV e raccogli tutti i codici non vuoti
    const records = parse(csvText, { skip_empty_lines: false });
    const flat = records.flat().map(cell => (cell || '').trim());
    const allCodes = flat.filter(c => c !== '');
    
    if (!allCodes.length) {
      console.log('⚠️ Nessun codice trovato nel CSV');
      return;
    }
    
    console.log(`✅ Trovati ${allCodes.length} codici nel CSV`);
    
    // Verifica se ci sono già codici nel database KV
    const existingCodes = await kv.get(CSV_KEY);
    if (existingCodes && existingCodes.length > 0) {
      console.log(`⚠️ Attenzione: Ci sono già ${existingCodes.length} codici nel database KV.`);
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise((resolve) => {
        readline.question('Vuoi sovrascrivere i codici esistenti? (s/n): ', resolve);
      });
      
      readline.close();
      
      if (answer.toLowerCase() !== 's') {
        console.log('❌ Operazione annullata');
        return;
      }
    }
    
    // Carica i codici nel database KV
    console.log(`🔄 Caricamento di ${allCodes.length} codici nel database KV...`);
    await kv.set(CSV_KEY, allCodes);
    
    console.log('✅ Codici caricati con successo!');
    
  } catch (err) {
    console.error('❌ ERRORE:', err);
  }
}

// Esegui la funzione
initializeCodesFromFile().then(() => {
  console.log('✨ Operazione completata');
});
