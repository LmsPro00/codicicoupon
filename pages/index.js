import { useState } from 'react';

export default function Home() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleExtractCodes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/extract-codes', {
        method: 'POST'
      });
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error('Errore:', err);
      setError('Si è verificato un errore durante l\'estrazione dei codici');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      fontFamily: 'system-ui, -apple-system, sans-serif', 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '40px 20px' 
    }}>
      <h1>Estrazione Codici Lions 2025</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={handleExtractCodes} 
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Estrazione in corso...' : 'Estrai 15 Codici'}
        </button>
      </div>

      {error && (
        <div style={{ color: 'red', margin: '20px 0' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ margin: '20px 0' }}>
          <h2>Risultato Estrazione</h2>
          
          <div style={{ marginBottom: '10px' }}>
            <strong>Codici rimanenti:</strong> {result.remaining}
          </div>
          
          {result.message ? (
            <p>{result.message}</p>
          ) : (
            <>
              <h3>Codici Estratti ({result.extracted.length}):</h3>
              <pre style={{ 
                backgroundColor: '#f4f4f4', 
                padding: '15px', 
                borderRadius: '5px',
                overflow: 'auto'
              }}>
                {result.extracted.join('\n')}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
