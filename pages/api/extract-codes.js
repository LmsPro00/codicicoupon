import { parse } from 'csv-parse/sync';
import { kv } from '@vercel/kv';

// Configurazione
const CSV_KEY = 'lions_codes';
const N_EXTRACT = parseInt(process.env.NUM_EXTRACT, 10) || 15;
const ZAPIER_URL = process.env.ZAPIER_WEBHOOK_URL;

// Funzione per inizializzare il database KV con i codici dal CSV (solo la prima volta)
async function initializeCodesFromCSV(csvContent) {
  try {
    // Verifica se i codici sono già stati caricati
    const existingCodes = await kv.get(CSV_KEY);
    if (existingCodes && existingCodes.length > 0) {
      console.log('I codici sono già stati inizializzati nel database KV');
      return existingCodes;
    }

    console.log('Inizializzazione dei codici dal CSV...');
    
    // Parsifica il CSV e raccogli tutti i codici non vuoti
    const records = parse(csvContent, { skip_empty_lines: false });
    const flat = records.flat().map(cell => (cell || '').trim());
    const allCodes = flat.filter(c => c !== '');
    
    // Memorizza i codici nel database KV
    if (allCodes.length > 0) {
      await kv.set(CSV_KEY, allCodes);
      console.log(`${allCodes.length} codici caricati nel database KV`);
    }
    
    return allCodes;
  } catch (err) {
    console.error('Errore durante l\'inizializzazione dei codici:', err);
    throw err;
  }
}

export default async function handler(req, res) {
  try {
    // Accetta solo richieste POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Metodo non consentito' });
    }

    // Inizializza o ottieni i codici disponibili
    const csvContent = req.body.csvContent || process.env.CSV_CONTENT;
    
    let allCodes;
    if (csvContent) {
      // Se viene fornito il contenuto CSV, inizializza il database
      allCodes = await initializeCodesFromCSV(csvContent);
    } else {
      // Altrimenti, usa i codici già presenti nel database
      allCodes = await kv.get(CSV_KEY);
    }

    // Verifica che ci siano codici disponibili
    if (!allCodes || allCodes.length === 0) {
      console.log('Nessun codice disponibile nel database KV');
      return res.status(200).json({ 
        message: 'Nessun codice disponibile', 
        extracted: [],
        remaining: 0
      });
    }

    // Estrai codici unici
    const n = Math.min(N_EXTRACT, allCodes.length);
    const selected = [];
    const pool = [...allCodes];
    
    while (selected.length < n) {
      const idx = Math.floor(Math.random() * pool.length);
      selected.push(pool.splice(idx, 1)[0]);
    }

    console.log(`Estratti ${selected.length} codici unici`);
    
    // Aggiorna il database KV rimuovendo i codici estratti
    const remainingCodes = allCodes.filter(code => !selected.includes(code));
    await kv.set(CSV_KEY, remainingCodes);
    
    // Invia a Zapier se l'URL è configurato
    if (ZAPIER_URL) {
      console.log('Invio a Zapier...');
      const response = await fetch(ZAPIER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          extracted_codes: selected, 
          timestamp: new Date().toISOString() 
        })
      });
      
      if (!response.ok) {
        console.error(`Errore nell'invio a Zapier: ${response.statusText}`);
      } else {
        console.log('Codici inviati con successo a Zapier');
      }
    } else {
      // Non segnaliamo errore se ZAPIER_URL non è configurato,
      // poiché potrebbe essere Zapier stesso a chiamare questa API
      console.log('ZAPIER_URL non configurato, invio saltato');
    }
    
    // Rispondi con i codici estratti e il numero di codici rimanenti
    return res.status(200).json({ 
      extracted: selected, 
      remaining: remainingCodes.length 
    });

  } catch (err) {
    console.error('ERRORE:', err);
    return res.status(500).json({ error: err.message });
  }
}
