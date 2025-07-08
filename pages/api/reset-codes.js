import { parse } from 'csv-parse/sync';
import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';

// Inizializza Redis con la variabile d'ambiente REDIS_URL
const redis = new Redis(process.env.REDIS_URL);

// Wrapper per emulare l'interfaccia di Vercel KV
const kv = {
  async get(key) {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  },
  async set(key, value) {
    return await redis.set(key, JSON.stringify(value));
  },
  async del(key) {
    return await redis.del(key);
  },
  async sadd(key, ...members) {
    return await redis.sadd(key, ...members);
  },
  async scard(key) {
    return await redis.scard(key);
  }
};

// Funzione per leggere il file CSV e inizializzare il database KV
async function initializeKVFromCSV(csvContent) {
  try {
    // Parsing del CSV
    const records = parse(csvContent, {
      columns: false,
      skip_empty_lines: true
    });

    // Estrai i codici dal CSV (presumendo che i codici siano nella prima colonna)
    const codes = [];
    records.forEach(record => {
      // Se la riga contiene una stringa singola (header del CSV)
      if (typeof record === 'string') {
        const rowCodes = record.split(',').map(c => c.trim()).filter(c => c !== '');
        codes.push(...rowCodes);
      }
      // Se la riga è un array (formato standard CSV)
      else if (Array.isArray(record)) {
        record.forEach(cell => {
          if (cell && typeof cell === 'string') {
            const cellCodes = cell.split(',').map(c => c.trim()).filter(c => c !== '');
            codes.push(...cellCodes);
          }
        });
      }
    });
    
    // Rimuovi eventuali duplicati
    const uniqueCodes = [...new Set(codes)];
    
    // Usa la stessa chiave 'lions_codes' come in extract-codes.js
    const CSV_KEY = 'lions_codes';
    
    // Salva i codici nel database KV come array JSON
    await kv.set(CSV_KEY, uniqueCodes);
    
    const totalCodes = uniqueCodes.length;
    
    return {
      success: true,
      message: `Database KV inizializzato con successo. Totale codici: ${totalCodes}`,
      totalCodes
    };
  } catch (error) {
    console.error('Errore durante l\'inizializzazione del KV dal CSV:', error);
    return {
      success: false,
      message: `Errore durante l\'inizializzazione: ${error.message}`,
      error: error.toString()
    };
  }
}

export default async function handler(req, res) {
  // Solo metodo POST è supportato
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo non consentito' });
  }
  
  try {
    let csvContent;
    
    // Controlla se il contenuto del CSV è fornito nel body
    if (req.body && req.body.csvContent) {
      csvContent = req.body.csvContent;
    } 
    // Altrimenti, controlla se il CSV è definito nelle variabili d'ambiente
    else if (process.env.CSV_CONTENT) {
      csvContent = process.env.CSV_CONTENT;
    } 
    // Altrimenti, se siamo in ambiente di sviluppo, leggi dal file locale
    else if (process.env.NODE_ENV === 'development') {
      const csvPath = path.join(process.cwd(), 'codici.csv');
      if (fs.existsSync(csvPath)) {
        csvContent = fs.readFileSync(csvPath, 'utf8');
      } else {
        return res.status(404).json({ 
          success: false, 
          message: 'File CSV non trovato e nessun contenuto CSV fornito nel body o nelle variabili d\'ambiente' 
        });
      }
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Nessun contenuto CSV fornito. Inserisci il contenuto CSV nel body della richiesta o nelle variabili d\'ambiente.' 
      });
    }
    
    // Inizializza il database KV con i codici dal CSV
    const result = await initializeKVFromCSV(csvContent);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Errore nell\'handler reset-codes:', error);
    res.status(500).json({ 
      success: false, 
      message: `Errore imprevisto: ${error.message}`, 
      error: error.toString() 
    });
  }
}
