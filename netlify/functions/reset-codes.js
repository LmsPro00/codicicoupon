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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Solo POST consentito' })
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const csvContent = body.csvContent || process.env.CSV_CONTENT;

    if (!csvContent) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'csvContent richiesto nel body o CSV_CONTENT nelle env vars' })
      };
    }

    // Parse CSV
    const records = parse(csvContent, { skip_empty_lines: false });
    const flat = records.flat().map((cell) => (cell || '').trim());
    const allCodes = flat.filter((c) => c !== '');

    if (allCodes.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Nessun codice valido trovato nel CSV' })
      };
    }

    // Salva i codici
    await kv.set(CSV_KEY, allCodes);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: `Caricati ${allCodes.length} codici nel database`,
        count: allCodes.length
      })
    };
  } catch (err) {
    console.error('ERRORE:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Errore server' })
    };
  }
};
