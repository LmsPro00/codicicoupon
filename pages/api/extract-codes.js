import { parse } from 'csv-parse/sync';
import Redis from 'ioredis';
import dns from 'dns';

// ========= Redis init (serverless-friendly + IPv4 DNS) =========
let _redis;
function getRedis() {
  if (_redis) return _redis;
  _redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 50, 1000),
    // Forza IPv4: evita ENOTFOUND/AAAA su alcuni provider/regioni
    dnsLookup: (hostname, options, callback) => {
      return dns.lookup(hostname, { family: 4 }, callback);
    },
  });
  // Log non bloccanti (utile per diagnosi)
  _redis.on('error', (e) => console.warn('[ioredis] error:', e?.message || e));
  return _redis;
}

// Aspetta che Redis sia "ready". Se non lo è entro timeout, lancia errore transiente
async function ensureRedisReady(timeoutMs = 1000) {
  const redis = getRedis();
  if (redis.status === 'ready') return redis;
  try { await redis.connect(); } catch (_) { /* ignore, retry loop sotto */ }
  const start = Date.now();
  while (redis.status !== 'ready' && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50));
  }
  if (redis.status !== 'ready') {
    const err = new Error('Redis not ready');
    err.__transient = true;
    throw err;
  }
  return redis;
}

// Wrapper tipo KV
const kv = {
  async get(key) {
    const redis = await ensureRedisReady();
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  },
  async set(key, value) {
    const redis = await ensureRedisReady();
    return await redis.set(key, JSON.stringify(value));
  },
  async del(key) {
    const redis = await ensureRedisReady();
    return await redis.del(key);
  },
  async acquireLock(lockKey, ttlMs = 8000) {
    const redis = await ensureRedisReady();
    const ok = await redis.set(lockKey, '1', 'PX', ttlMs, 'NX');
    return ok === 'OK';
  },
};

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

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  try {
    // 🔒 Lock per evitare corse
    const gotLock = await kv.acquireLock(LOCK_KEY, 8000);
    if (!gotLock) {
      return res.status(503).json({ error: 'In elaborazione, riprovare tra poco' });
    }

    try {
      const csvContent = (req.body && req.body.csvContent) || process.env.CSV_CONTENT;

      let allCodes;
      if (csvContent) {
        allCodes = await initializeCodesFromCSV(csvContent);
      } else {
        allCodes = await kv.get(CSV_KEY);
      }

      if (!allCodes || allCodes.length === 0) {
        return res.status(200).json({ message: 'Nessun codice disponibile', extracted: [], remaining: 0 });
      }

      const { selected, remaining } = pickNUniqueRandom(allCodes, N_EXTRACT);
      await kv.set(CSV_KEY, remaining);

      const shouldSendToZapier =
        ZAPIER_URL && req.method === 'POST' && !(req.body && req.body.sendToZapier === false);

      if (shouldSendToZapier) {
        try {
          const response = await fetch(ZAPIER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extracted_codes: selected, timestamp: new Date().toISOString() }),
          });
          if (!response.ok) console.error('Errore invio a Zapier:', response.status, response.statusText);
        } catch (zapErr) {
          console.error('Errore durante invio a Zapier:', zapErr);
        }
      }

      return res.status(200).json({ extracted: selected, remaining: remaining.length });
    } finally {
      try { await kv.del(LOCK_KEY); } catch {}
    }
  } catch (err) {
    console.error('ERRORE:', err);
    const msg = String(err?.message || '');
    const isDns = /ENOTFOUND|EAI_AGAIN/i.test(msg);
    const isTransient = err.__transient || isDns || /ECONNRESET|ETIMEDOUT|max retries per request/i.test(msg);

    // 503 => Zapier può ritentare automaticamente
    if (isTransient) return res.status(503).json({ error: 'Errore temporaneo Redis/DNS, riprovare' });
    return res.status(500).json({ error: err.message || 'Errore server' });
  }
}
