# Guida al Deployment su Netlify

Questa guida ti aiuterà a deployare l'applicazione su Netlify in modo semplice e veloce.

## Prerequisiti

- Un account su [Netlify](https://app.netlify.com/)
- Node.js e npm installati localmente

## Opzione 1: Deployment Automatico (Consigliato)

### 1. Esegui lo script di deployment

Abbiamo creato uno script semplificato che automatizza il processo di deployment:

```
.\deploy-simple.bat
```

Questo script:
- Esegue il build dell'applicazione
- Installa temporaneamente netlify-cli
- Tenta il deployment automatico
- In caso di errore, fornisce istruzioni per il deployment manuale

## Opzione 2: Deployment Manuale

### 1. Esegui il build dell'applicazione

```
npm run build
```

### 2. Carica su Netlify

1. Accedi a [Netlify](https://app.netlify.com/)
2. Clicca su "Add new site" e seleziona "Deploy manually"
3. Trascina la cartella `.next` nella zona di drop
4. Attendi il completamento del deployment

### 3. Configura le variabili d'ambiente

Dopo il deployment, vai su:
- Site settings > Environment variables

Aggiungi le seguenti variabili:
- `ZAPIER_WEBHOOK_URL`: URL del webhook Zapier
- `NUM_EXTRACT`: 15 (o il numero di codici da estrarre)
- `REDIS_URL`: URL del tuo server Redis (se disponibile in produzione)

## Verifica del Deployment

1. Accedi all'URL del tuo sito Netlify
2. Testa l'endpoint `/api/extract-codes` per verificare che funzioni correttamente
3. Verifica che l'integrazione con Zapier funzioni (se configurata)

## Troubleshooting

### Problema: Il deployment fallisce con errore di build

Verifica che:
- Tutte le dipendenze siano installate (`npm install`)
- Il file `netlify.toml` sia configurato correttamente
- Non ci siano errori nel codice

### Problema: L'API non funziona dopo il deployment

Verifica che:
- Le variabili d'ambiente siano configurate correttamente
- I codici siano stati caricati nel database (usa l'endpoint `/api/reset-codes`)

## Note sul Sistema di Storage

L'applicazione utilizza un sistema di storage flessibile che supporta:

1. **Vercel KV** - In produzione, quando sono configurate le variabili `KV_REST_API_URL` e `KV_REST_API_TOKEN`
2. **Redis** - Quando è configurata la variabile `REDIS_URL`
3. **In-memory Storage** - Fallback automatico per sviluppo locale quando Redis non è disponibile

Su Netlify, è consigliabile utilizzare Redis configurando la variabile `REDIS_URL`.
