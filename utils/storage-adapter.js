/**
 * Storage adapter che supporta sia Redis che un fallback in-memory
 * per lo sviluppo locale senza Redis
 */

// Storage in-memory per lo sviluppo locale
const inMemoryStorage = new Map();

/**
 * Crea un client di storage che tenta di usare Redis se disponibile,
 * altrimenti usa un semplice storage in-memory
 */
export function createStorageClient() {
  // Verifica se è configurato Redis
  const hasRedisConfig = process.env.REDIS_URL || 
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  
  // Se non c'è configurazione Redis, usa lo storage in-memory
  if (!hasRedisConfig) {
    console.log('⚠️ Redis non configurato. Utilizzo storage in-memory (solo per sviluppo)');
    return createInMemoryClient();
  }
  
  // Altrimenti tenta di usare Redis
  try {
    // Se è configurato Vercel KV
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { createClient } = require('@vercel/kv');
      console.log('🔄 Connessione a Vercel KV...');
      
      return createClient({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      });
    }
    
    // Se è configurato Redis diretto
    if (process.env.REDIS_URL) {
      const Redis = require('ioredis');
      console.log('🔄 Connessione a Redis...');
      
      const redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 100, 1000);
        }
      });
      
      // Wrapper per uniformare l'interfaccia con Vercel KV
      return {
        async get(key) {
          const value = await redis.get(key);
          return value ? JSON.parse(value) : null;
        },
        async set(key, value) {
          return await redis.set(key, JSON.stringify(value));
        },
        async del(key) {
          return await redis.del(key);
        }
      };
    }
  } catch (err) {
    console.error('❌ Errore connessione Redis:', err.message);
    console.log('⚠️ Fallback a storage in-memory (solo per sviluppo)');
    return createInMemoryClient();
  }
  
  // Fallback a in-memory se qualcosa va storto
  return createInMemoryClient();
}

/**
 * Crea un client di storage in-memory che emula l'interfaccia di Redis/Vercel KV
 */
function createInMemoryClient() {
  return {
    async get(key) {
      return inMemoryStorage.get(key) || null;
    },
    async set(key, value) {
      inMemoryStorage.set(key, value);
      return 'OK';
    },
    async del(key) {
      inMemoryStorage.delete(key);
      return 1;
    }
  };
}
