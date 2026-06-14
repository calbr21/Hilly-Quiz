import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import socket from '../socket.js'

function Join() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [pin, setPin] = useState(() => (searchParams.get('pin') || '').replace(/\D/g, '').slice(0, 4))
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pastNicknames, setPastNicknames] = useState([])

  useEffect(() => {
    // Load past nicknames from localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('hilly-quiz-nicknames') || '[]')
      setPastNicknames(stored)
    } catch {
      setPastNicknames([])
    }

    // Listen for join result
    const onJoined = ({ success, gameId, nickname: nick }) => {
      if (success) {
        // Save game info
        localStorage.setItem('hilly-quiz-gameId', gameId)
        localStorage.setItem('hilly-quiz-nickname', nick)

        // Save nickname to history
        try {
          const stored = JSON.parse(localStorage.getItem('hilly-quiz-nicknames') || '[]')
          const updated = [nick, ...stored.filter(n => n !== nick)].slice(0, 8)
          localStorage.setItem('hilly-quiz-nicknames', JSON.stringify(updated))
        } catch {}

        navigate('/play')
      }
    }

    const onError = ({ message }) => {
      setError(message)
      setLoading(false)
    }

    socket.on('player:joined', onJoined)
    socket.on('player:join_error', onError)

    return () => {
      socket.off('player:joined', onJoined)
      socket.off('player:join_error', onError)
    }
  }, [navigate])

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    const trimmedPin = pin.trim()
    const trimmedNick = nickname.trim()

    if (!trimmedPin || trimmedPin.length !== 4) {
      setError('Please enter a valid 4-digit PIN.')
      return
    }
    if (!trimmedNick || trimmedNick.length < 1) {
      setError('Please enter a nickname.')
      return
    }

    setLoading(true)
    socket.emit('player:join', { pin: trimmedPin, nickname: trimmedNick })
  }

  return (
    <div className="page">
      <div className="card">
        <h2>Join a Game</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="pin">Game PIN</label>
            <input
              id="pin"
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="Enter 4-digit PIN"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              autoComplete="off"
              style={{ fontSize: '1.5rem', letterSpacing: '0.2em', textAlign: 'center' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="nickname">Your Nickname</label>
            <input
              id="nickname"
              type="text"
              maxLength={20}
              placeholder="Enter your nickname"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              autoComplete="off"
            />
            {pastNicknames.length > 0 && (
              <div className="mt-1">
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>Quick pick:</span>
                <div className="quick-picks">
                  {pastNicknames.map(n => (
                    <button
                      key={n}
                      type="button"
                      className="quick-pick-btn"
                      onClick={() => setNickname(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary mt-2"
            disabled={loading}
          >
            {loading ? 'Joining...' : '🎮 Join Game'}
          </button>
        </form>

        <div className="text-center mt-3">
          <Link to="/" className="nav-link">← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}

export default Join
