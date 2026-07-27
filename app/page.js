export default function HomePage() {
    return (
        <main style={{ 
            fontFamily: 'system-ui', 
            padding: '40px', 
            background: '#0a0e1a', 
            color: '#f8fafc', 
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>🔐 CIDS Suites Pro</h1>
            <p style={{ color: '#64748b' }}>License Management API</p>
            <p style={{ color: '#22c55e', marginTop: '16px', fontSize: '14px' }}>✅ API is running</p>
        </main>
    );
}
