# Lions 2025 - Estrazione Codici per Zapier

Questo progetto è un'API serverless per estrarre 15 codici unici casuali da un database e inviarli a Zapier, come parte di un flusso di automazione.

## Struttura del Progetto

- `/pages/api/extract-codes.js` - API endpoint per estrarre 15 codici unici
- `/pages/index.js` - Interfaccia web semplice per testare l'estrazione
- `/scripts/init-kv-storage.js` - Script per inizializzare il database KV con i codici

## Come Deployare su Vercel

### 1. Preparazione

1. Crea un account su [Vercel](https://vercel.com/) se non ne hai già uno
2. Installa la CLI di Vercel:
   ```
   npm i -g vercel
   ```

### 2. Crea un Database KV su Vercel

1. Vai sulla [Dashboard di Vercel](https://vercel.com/dashboard)
2. Seleziona il tuo team o crea un nuovo progetto
3. Vai su "Storage" e clicca su "Create" per creare un nuovo database KV
4. Segui le istruzioni per creare il database
5. Una volta creato, prendi nota delle variabili d'ambiente (KV_URL, KV_REST_API_URL, ecc.)

### 3. Deployment

1. Esegui il login da terminale:
   ```
   vercel login
   ```

2. Nella directory del progetto, esegui:
   ```
   vercel
   ```

3. Segui le istruzioni per completare il deployment

### 4. Configura le Variabili d'Ambiente

Dopo il deployment:

1. Vai su Vercel Dashboard > Il tuo progetto > Settings > Environment Variables
2. Aggiungi le seguenti variabili:
   - `ZAPIER_WEBHOOK_URL`: URL del webhook Zapier
   - `NUM_EXTRACT`: 15 (o il numero di codici da estrarre)
   - Le credenziali KV ottenute nel passaggio 2

### 5. Carica Inizialmente i Codici nel Database KV

Hai due opzioni per caricare inizialmente i codici nel database KV:

#### Opzione 1: Tramite chiamata API

Invia una richiesta POST all'API con il contenuto del CSV:

```
curl -X POST https://tuo-progetto.vercel.app/api/extract-codes \
  -H "Content-Type: application/json" \
  -d '{"csvContent":"IOCREO25101,IOCREO25102,IOCREO25103..."}'
```

#### Opzione 2: Tramite script locale

1. Crea un file `.env` nella directory del progetto con le credenziali KV:
   ```
   KV_REST_API_URL=https://...
   KV_REST_API_TOKEN=...
   ```

2. Esegui lo script:
   ```
   node -r dotenv/config scripts/init-kv-storage.js
   ```

## Utilizzo in Zapier

Nel tuo flusso Zapier:

1. Trigger PandaDoc: quando un documento viene inviato
2. Aggiorna i dati su HubSpot (primo step)
3. Chiama l'API per estrarre 15 codici:
   - URL: `https://tuo-progetto.vercel.app/api/extract-codes`
   - Metodo: `POST`
   - I codici estratti saranno disponibili nell'output come `extracted_codes`
4. Invia i codici a HubSpot come proprietà

## Note Importanti

- I codici sono memorizzati in un database KV su Vercel e vengono estratti in modo casuale
- Una volta estratti, i codici vengono rimossi dal database e non saranno più disponibili
- Quando i codici si esauriscono, l'API restituirà un array vuoto e un messaggio

## Sviluppo Locale

### Storage Adapter

L'applicazione utilizza un sistema di storage flessibile che supporta:

1. **Vercel KV** - In produzione, quando sono configurate le variabili `KV_REST_API_URL` e `KV_REST_API_TOKEN`
2. **Redis** - Quando è configurata la variabile `REDIS_URL`
3. **In-memory Storage** - Fallback automatico per sviluppo locale quando Redis non è disponibile

Questo permette di sviluppare e testare l'applicazione localmente senza dover installare Redis.

### Configurazione per Sviluppo

1. Crea un file `.env` con le seguenti variabili:
   ```
   # URL del webhook Zapier (opzionale per sviluppo)
   ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/your-webhook-id-here
   
   # Numero di codici da estrarre (default: 15)
   NUM_EXTRACT=15
   ```

2. Avvia il server di sviluppo:
   ```
   npm run dev
   ```

3. L'applicazione utilizzerà automaticamente lo storage in-memory per lo sviluppo locale
