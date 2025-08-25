/**
 * Storage adapter che supporta sia Redis che un fallback in-memory
 * per lo sviluppo locale senza Redis
 */

// Storage in-memory per lo sviluppo locale
const inMemoryStorage = new Map();

/**
 * Crea un client di storage con fallback automatico robusto
 */
export function createStorageClient() {
  // Se è configurato Vercel KV, prova quello per primo
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { createClient } = require('@vercel/kv');
      console.log('🔄 Connessione a Vercel KV...');
      return createClient({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      });
    } catch (err) {
      console.error('❌ Errore Vercel KV:', err.message);
    }
  }
  
  // Se è configurato Redis, prova con fallback automatico
  if (process.env.REDIS_URL) {
    try {
      const Redis = require('ioredis');
      console.log('🔄 Connessione a Redis con fallback automatico...');
      
      const redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 0, // Disabilita retry automatici
        connectTimeout: 3000,
        lazyConnect: true,
        enableOfflineQueue: false,
        retryStrategy: () => null // Non ritentare connessioni
      });
      
      let isRedisWorking = true;
      
      redis.on('error', (err) => {
        console.error('❌ Redis error, switching to in-memory:', err.message);
        isRedisWorking = false;
      });
      
      redis.on('close', () => {
        console.log('⚠️ Redis connection closed, using in-memory');
        isRedisWorking = false;
      });
      
      // Wrapper con fallback automatico
      const fallbackClient = createInMemoryClient();
      
      return {
        async get(key) {
          if (!isRedisWorking) return fallbackClient.get(key);
          try {
            const value = await redis.get(key);
            return value ? JSON.parse(value) : null;
          } catch (err) {
            console.log('⚠️ Redis get failed, using in-memory');
            isRedisWorking = false;
            return fallbackClient.get(key);
          }
        },
        async set(key, value) {
          if (!isRedisWorking) return fallbackClient.set(key, value);
          try {
            return await redis.set(key, JSON.stringify(value));
          } catch (err) {
            console.log('⚠️ Redis set failed, using in-memory');
            isRedisWorking = false;
            return fallbackClient.set(key, value);
          }
        },
        async del(key) {
          if (!isRedisWorking) return fallbackClient.del(key);
          try {
            return await redis.del(key);
          } catch (err) {
            console.log('⚠️ Redis del failed, using in-memory');
            isRedisWorking = false;
            return fallbackClient.del(key);
          }
        },
        async acquireLock(lockKey, ttlMs = 8000) {
          if (!isRedisWorking) return fallbackClient.acquireLock(lockKey, ttlMs);
          try {
            const ok = await redis.set(lockKey, '1', 'PX', ttlMs, 'NX');
            return ok === 'OK';
          } catch (err) {
            console.log('⚠️ Redis acquireLock failed, using in-memory');
            isRedisWorking = false;
            return fallbackClient.acquireLock(lockKey, ttlMs);
          }
        }
      };
    } catch (err) {
      console.error('❌ Errore inizializzazione Redis:', err.message);
    }
  }
  
  // Fallback finale a in-memory
  console.log('🔄 Utilizzo storage in-memory');
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
    },
    async acquireLock(lockKey, ttlMs = 8000) {
      if (inMemoryStorage.has(lockKey)) return false;
      inMemoryStorage.set(lockKey, Date.now() + ttlMs);
      setTimeout(() => inMemoryStorage.delete(lockKey), ttlMs);
      return true;
    }
  };
}
