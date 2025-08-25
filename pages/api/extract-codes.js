import { parse } from 'csv-parse/sync';
import Redis from 'ioredis';

// ========= Redis init (serverless-friendly) =========
let _redis;
function getRedis() {
  if (_redis) return _redis;
  _redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,     // evita i 20 tentativi che fanno esplodere la request
    enableOfflineQueue: false,   // non accodare chiamate se la connessione cade
    lazyConnect: true,           // connetti solo quando serve
    retryStrategy: (times) => Math.min(times * 50, 1000) // backoff breve
  });
  return _redis;
}

// Wrapper tipo Vercel KV (JSON su chiave singola)
const kv = {
  async get(key) {
    const redis = getRedis();
    if (redis.status === 'end') await redis.connect();
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  },
  async set(key, value) {
    const redis = getRedis();
    if (redis.status === 'end') await redis.connect();
    return await redis.set(key, JSON.stringify(value));
  },
  async del(key) {
    const redis = getRedis();
    if (redis.status === 'end') await redis.connect();
    return await redis.del(key);
  },
  // lock semplice con TTL: ritorna true se acquisito, false se già in uso
  async acquireLock(lockKey, ttlMs = 8000) {
    const redis = getRedis();
    if (redis.status === 'end') await redis.connect();
    const ok = await redis.set(lockKey, '1', 'PX', ttlMs, 'NX');
    return ok === 'OK';
  }
};

// ========= Config =========
const CSV_KEY = 'lions_codes';
const LOCK_KEY = 'lock:lions_codes';
const N_EXTRACT = parseInt(process.env.NUM_EXTRACT, 10) || 15;
const ZAPIER_URL = process.env.ZAPIER_WEBHOOK_URL;

// ========= Helpers =========
async function initializeCodesFromCSV(csvContent) {
  try {
    const existingCodes = await kv.get(CSV_KEY);
    if (existingCodes && existingCodes.length > 0) {
      console.log('I codici sono già stati inizializzati nel database KV');
      return existingCodes;
    }

    console.log('Inizializzazione dei codici dal CSV...');
    const records = parse(csvContent, { skip_empty_lines: false });
    const flat = records.flat().map((cell) => (cell || '').trim());
    const allCodes = flat.filter((c) => c !== '');

    if (allCodes.length > 0) {
      await kv.set(CSV_KEY, allCodes);
      console.log(`${allCodes.length} codici caricati nel database KV`);
    }

    return allCodes;
  } catch (err) {
    console.error("Errore durante l'inizializzazione dei codici:", err);
    throw err;
  }
}

function pickNUniqueRandom(arr, n) {
  // Estrazione casuale senza ripetizioni
  const pool = [...arr];
  const selected = [];
  const count = Math.min(n, pool.length);
  while (selected.length < count) {
    const idx = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(idx, 1)[0]);
  }
  return { selected, remaining: pool };
}

// ========= Handler =========
export default async function handler(req, res) {
  // Supporta GET e POST
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  try {
    // Tenta connessione early per intercettare eventuali errori Redis
    const redis = getRedis();
    if (redis.status === 'end') await redis.connect();

    // Prova ad acquisire un lock per evitare corse concorrenti
    const gotLock = await kv.acquireLock(LOCK_KEY, 8000); // 8 secondi
    if (!gotLock) {
      // Qualcun altro sta estraendo ora: chiedi a Zapier di riprovare
      return res.status(503).json({ error: 'In elaborazione, riprovare tra poco' });
    }

    try {
      // Legge CSV da body (POST) o ENV; in GET di solito non arriva un body
      // NB: con Next.js pages/api, per POST JSON assicurati di inviare header Content-Type: application/json
      const csvContent =
        (req.body && req.body.csvContent) || process.env.CSV_CONTENT;

      let allCodes;
      if (csvContent) {
        allCodes = await initializeCodesFromCSV(csvContent);
      } else {
        allCodes = await kv.get(CSV_KEY);
      }

      if (!allCodes || allCodes.length === 0) {
        console.log('Nessun codice disponibile nel database KV');
        return res.status(200).json({
          message: 'Nessun codice disponibile',
          extracted: [],
          remaining: 0
        });
      }

      // Estrai N codici e aggiorna KV
      const { selected, remaining } = pickNUniqueRandom(allCodes, N_EXTRACT);
      console.log(`Estratti ${selected.length} codici unici`);

      await kv.set(CSV_KEY, remaining);

      // Invio a Zapier solo se:
      // - esiste ZAPIER_URL
      // - è una POST
      // - e NON è stato esplicitamente disabilitato con sendToZapier === false
      const shouldSendToZapier =
        ZAPIER_URL && req.method === 'POST' && !(req.body && req.body.sendToZapier === false);

      if (shouldSendToZapier) {
        console.log('Invio a Zapier...');
        try {
          const response = await fetch(ZAPIER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              extracted_codes: selected,
              timestamp: new Date().toISOString()
            })
          });

          if (!response.ok) {
            console.error(`Errore nell'invio a Zapier: ${response.status} ${response.statusText}`);
            // Non blocchiamo l'esecuzione
          } else {
            console.log('Codici inviati con successo a Zapier');
          }
        } catch (zapErr) {
          console.error("Errore durante l'invio a Zapier:", zapErr);
          // Non blocchiamo l'esecuzione
        }
      } else if (!ZAPIER_URL) {
        console.log('ZAPIER_URL non configurato, invio saltato');
      }

      return res.status(200).json({
        extracted: selected,
        remaining: remaining.length
      });
    } finally {
      // Rilascia il lock
      try {
        await kv.del(LOCK_KEY);
      } catch (unlockErr) {
        console.warn('Impossibile rimuovere il lock (verrà sovrascritto dal TTL):', unlockErr);
      }
    }
  } catch (err) {
    // Se è un errore transitorio Redis/connessione, restituiamo 503 per permettere retry automatico
    const transient =
      /ECONNRESET|ETIMEDOUT|EAI_AGAIN|Connection is closed|max retries per request/i.test(
        String(err && err.message)
      );
    console.error('ERRORE:', err);
    if (transient) {
      return res.status(503).json({ error: 'Errore temporaneo Redis, riprovare' });
    }
    return res.status(500).json({ error: err.message || 'Errore server' });
  }
}
