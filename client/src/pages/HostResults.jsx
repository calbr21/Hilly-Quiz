import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

function HostResults() {
  const navigate = useNavigate()
  const [finalScores, setFinalScores] = useState([])
  const [leaderboard, setLeaderboard] = useState([])

  useEffect(() => {
    try {
      const fs = JSON.parse(localStorage.getItem('hilly-quiz-final-scores') || '[]')
      const lb = JSON.parse(localStorage.getItem('hilly-quiz-leaderboard') || '[]')
      setFinalScores(fs)
      setLeaderboard(lb)
    } catch {
      setFinalScores([])
      setLeaderboard([])
    }
  }, [])

  const first = finalScores[0]
  const second = finalScores[1]
  const third = finalScores[2]
  const rest = finalScores.slice(3)

  return (
    <div className="page-top">
      <div className="card-wide" style={{ textAlign: 'center' }}>
        <h2>🎉 Game Over!</h2>

        {/* Podium */}
        {finalScores.length > 0 && (
          <div className="podium" style={{ marginBottom: '2rem' }}>
            {/* 2nd place */}
            {second && (
              <div className="podium-place">
                <div className="podium-name">{second.nickname}</div>
                <div className="podium-score">{second.score} pts</div>
                <div className="podium-block second">🥈</div>
              </div>
            )}

            {/* 1st place */}
            {first && (
              <div className="podium-place">
                <div className="podium-name" style={{ fontSize: '1.1rem', fontWeight: '800' }}>{first.nickname}</div>
                <div className="podium-score" style={{ fontSize: '1rem' }}>{first.score} pts</div>
                <div className="podium-block first">🥇</div>
              </div>
            )}

            {/* 3rd place */}
            {third && (
              <div className="podium-place">
                <div className="podium-name">{third.nickname}</div>
                <div className="podium-score">{third.score} pts</div>
                <div className="podium-block third">🥉</div>
              </div>
            )}
          </div>
        )}

        {/* Full scores */}
        {finalScores.length > 3 && (
          <>
            <h3 style={{ marginBottom: '0.75rem' }}>All Scores</h3>
            <ul className="scores-list" style={{ margin: '0 auto' }}>
              {finalScores.map((player, i) => (
                <li key={player.nickname} className="score-item">
                  <span className="rank">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                  </span>
                  <span className="name">{player.nickname}</span>
                  <span className="points">{player.score} pts</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <hr className="divider" />

        <div className="btn-group">
          <button className="btn btn-secondary" onClick={() => navigate('/leaderboard')}>
            🏆 View Leaderboard
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/host')}>
            🔄 Play Again
          </button>
        </div>

        <video
          src="/outro.mp4"
          autoPlay
          loop
          muted
          playsInline
          style={{ width: '100%', maxWidth: '480px', borderRadius: '12px', marginTop: '2rem' }}
        />

        <div className="text-center mt-3">
          <Link to="/" className="nav-link">← Home</Link>
        </div>
      </div>
    </div>
  )
}

export default HostResults
