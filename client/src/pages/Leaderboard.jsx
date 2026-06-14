import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

function Leaderboard() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => {
        setEntries(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load leaderboard.')
        setLoading(false)
      })
  }, [])

  const rankEmoji = (i) => {
    if (i === 0) return '🥇'
    if (i === 1) return '🥈'
    if (i === 2) return '🥉'
    return `#${i + 1}`
  }

  return (
    <div className="page-top">
      <div className="card-wide">
        <h2>🏆 All-Time Leaderboard</h2>

        {error && <div className="alert alert-error">{error}</div>}
        {loading && <div className="spinner" />}

        {!loading && entries.length === 0 && (
          <div className="alert alert-info">
            No scores yet — play some games to get on the board!
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Total Points</th>
                  <th>Games Played</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr key={entry.name}>
                    <td style={{ fontSize: '1.1rem', fontWeight: '700' }}>{rankEmoji(i)}</td>
                    <td style={{ fontWeight: '600' }}>{entry.name}</td>
                    <td style={{ color: '#fbbf24', fontWeight: '700' }}>{entry.total_points}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{entry.games_played}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-center mt-4">
          <Link to="/" className="btn btn-secondary" style={{ display: 'inline-block', width: 'auto', padding: '0.75rem 2rem' }}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Leaderboard
