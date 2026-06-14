import { useNavigate, Link } from 'react-router-dom'

function Home() {
  const navigate = useNavigate()

  return (
    <div className="page">
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>🎉</div>
        <h1>Hilly Quiz</h1>
        <p className="text-muted mt-2" style={{ fontSize: '1.1rem' }}>
          The family quiz game — play together, laugh together!
        </p>
      </div>

      <div className="card" style={{ gap: '1rem', display: 'flex', flexDirection: 'column' }}>
        <button className="btn btn-primary" style={{ fontSize: '1.3rem', padding: '1.25rem' }} onClick={() => navigate('/join')}>
          🎮 Join Game
        </button>
        <button className="btn btn-secondary" style={{ fontSize: '1.3rem', padding: '1.25rem' }} onClick={() => navigate('/host')}>
          📺 Host Game
        </button>
      </div>

      <div className="nav-links">
        <Link to="/leaderboard" className="nav-link">🏆 Leaderboard</Link>
        <Link to="/admin" className="nav-link">⚙️ Admin</Link>
      </div>
    </div>
  )
}

export default Home
