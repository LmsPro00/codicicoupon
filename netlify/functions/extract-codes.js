const { parse } = require('csv-parse/sync');

// Storage adapter per Netlify Functions
const createStorageClient = () => {
  // In-memory storage per Netlify (semplificato)
  let memoryStore = {};
  
  return {
    async get(key) {
      return memoryStore[key] || null;
    },
    async set(key, value) {
      memoryStore[key] = value;
      return 'OK';
    },
    async del(key) {
      delete memoryStore[key];
      return 1;
    },
    async acquireLock(lockKey, ttlMs = 8000) {
      if (memoryStore[lockKey]) return false;
      memoryStore[lockKey] = Date.now() + ttlMs;
      setTimeout(() => delete memoryStore[lockKey], ttlMs);
      return true;
    }
  };
};

const kv = createStorageClient();

const CSV_KEY = 'lions_codes';
const LOCK_KEY = 'lock:lions_codes';
const N_EXTRACT = parseInt(process.env.NUM_EXTRACT, 10) || 15;
const ZAPIER_URL = process.env.ZAPIER_WEBHOOK_URL;

async function initializeCodesFromCSV(csvContent) {
  const existingCodes = await kv.get(CSV_KEY);
  if (existingCodes && existingCodes.length > 0) return existingCodes;
  const records = parse(csvContent, { skip_empty_lines: false });
  const flat = records.flat().map((cell) => (cell || '').trim());
  const allCodes = flat.filter((c) => c !== '');
  if (allCodes.length > 0) await kv.set(CSV_KEY, allCodes);
  return allCodes;
}

function pickNUniqueRandom(arr, n) {
  const pool = [...arr];
  const selected = [];
  const count = Math.min(n, pool.length);
  while (selected.length < count) {
    const idx = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(idx, 1)[0]);
  }
  return { selected, remaining: pool };
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Metodo non consentito' })
    };
  }

  try {
    // Lock per evitare corse
    const gotLock = await kv.acquireLock(LOCK_KEY, 8000);
    if (!gotLock) {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ error: 'In elaborazione, riprovare tra poco' })
      };
    }

    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const csvContent = body.csvContent || process.env.CSV_CONTENT;

      let allCodes;
      if (csvContent) {
        allCodes = await initializeCodesFromCSV(csvContent);
      } else {
        allCodes = await kv.get(CSV_KEY);
      }

      if (!allCodes || allCodes.length === 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            message: 'Nessun codice disponibile', 
            extracted: [], 
            remaining: 0 
          })
        };
      }

      const { selected, remaining } = pickNUniqueRandom(allCodes, N_EXTRACT);
      await kv.set(CSV_KEY, remaining);

      const shouldSendToZapier = ZAPIER_URL && event.httpMethod === 'POST' && 
        !(body && body.sendToZapier === false);

      if (shouldSendToZapier) {
        try {
          const response = await fetch(ZAPIER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              extracted_codes: selected, 
              timestamp: new Date().toISOString(),
              remaining_count: remaining.length
            }),
          });
          if (!response.ok) {
            console.error('Errore invio a Zapier:', response.status, response.statusText);
          } else {
            console.log('Codici inviati con successo a Zapier');
          }
        } catch (zapErr) {
          console.error('Errore durante invio a Zapier:', zapErr);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          extracted: selected, 
          remaining: remaining.length,
          message: `Estratti ${selected.length} codici`
        })
      };
    } finally {
      try { await kv.del(LOCK_KEY); } catch {}
    }
  } catch (err) {
    console.error('ERRORE:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Errore server' })
    };
  }
};
