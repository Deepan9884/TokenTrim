export default function BackendIndex() {
  return (
    <div style={{ maxWidth: '640px', margin: '40px auto', lineHeight: '1.6' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#38bdf8', marginBottom: '8px' }}>
        TokenTrim API Backend
      </h1>
      <p style={{ color: '#94a3b8', marginBottom: '24px' }}>
        Serverless API backend for TokenTrim Chrome Extension & Admin Dashboard.
      </p>
      <div style={{ background: '#1e293b', padding: '16px 20px', borderRadius: '8px', border: '1px solid #334155' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#cbd5e1' }}><strong>Status:</strong> Active & Ready</p>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#cbd5e1' }}><strong>Health Check:</strong> <a href="/api/health" style={{ color: '#38bdf8' }}>/api/health</a></p>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#cbd5e1' }}><strong>Extension Auth:</strong> /api/auth/*</p>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#cbd5e1' }}><strong>Document Cloud Sync:</strong> /api/documents/*</p>
        <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1' }}><strong>Telemetry & Events:</strong> /api/events</p>
      </div>
    </div>
  );
}
