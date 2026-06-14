import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import QRCode from 'qrcode'
import socket from '../socket.js'

const QUESTION_COUNT_OPTIONS = [
  { label: '5 Questions', value: 5 },
  { label: '10 Questions', value: 10 },
  { label: '15 Questions', value: 15 },
  { label: '20 Questions', value: 20 },
  { label: 'All Questions', value: 'all' }
]

const ROUND_OPTIONS = [3, 5, 7, 10]

const WORD_TIME_OPTIONS = [
  { label: '1 minute', value: 60 },
  { label: '2 minutes', value: 120 },
  { label: '3 minutes', value: 180 }
]

function HostLobby() {
  const navigate = useNavigate()
  const [gameMode, setGameMode] = useState('quiz')
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [questionCount, setQuestionCount] = useState(10)
  const [topics, setTopics] = useState([])
  const [topic, setTopic] = useState('')
  const [rounds, setRounds] = useState(5)
  const [wordTimeLimit, setWordTimeLimit] = useState(120)
  const [gameCreated, setGameCreated] = useState(false)
  const [pin, setPin] = useState('')
  const [gameId, setGameId] = useState('')
  const [players, setPlayers] = useState([])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')

  // Fetch categories
  useEffect(() => {
    fetch('/api/admin/categories')
      .then(r => r.json())
      .then(data => {
        setCategories(data)
        if (data.length > 0) setCategoryId(data[0].id)
      })
      .catch(() => setError('Failed to load categories.'))
  }, [])

  // Fetch draw topics
  useEffect(() => {
    fetch('/api/draw-topics')
      .then(r => r.json())
      .then(data => {
        setTopics(data)
        if (data.length > 0) setTopic(data[0])
      })
      .catch(() => {})
  }, [])

  // Socket listeners
  useEffect(() => {
    const onCreated = ({ pin: p, gameId: gid, mode }) => {
      setPin(p)
      setGameId(gid)
      setGameCreated(true)
      setCreating(false)
      localStorage.setItem('hilly-quiz-host-gameId', gid)
      localStorage.setItem('hilly-quiz-host-pin', p)
      localStorage.setItem('hilly-quiz-host-mode', mode || 'quiz')

      const joinUrl = `${window.location.origin}/join?pin=${p}`
      QRCode.toDataURL(joinUrl, { width: 220, margin: 1 })
        .then(setQrCodeUrl)
        .catch(() => setQrCodeUrl(''))
    }

    const onPlayerJoined = ({ players: p }) => {
      setPlayers(p)
    }

    const onError = ({ message }) => {
      setError(message)
      setCreating(false)
    }

    socket.on('host:created', onCreated)
    socket.on('lobby:player_joined', onPlayerJoined)
    socket.on('error', onError)

    return () => {
      socket.off('host:created', onCreated)
      socket.off('lobby:player_joined', onPlayerJoined)
      socket.off('error', onError)
    }
  }, [navigate])

  const handleCreate = () => {
    setError('')

    if (gameMode === 'draw') {
      if (!topic) {
        setError('Please select a topic.')
        return
      }
      setCreating(true)
      socket.emit('host:create_draw', { topic, rounds })
      return
    }

    if (gameMode === 'word') {
      setCreating(true)
      socket.emit('host:create_word', { timeLimit: wordTimeLimit })
      return
    }

    if (gameMode === 'bingo') {
      setCreating(true)
      socket.emit('host:create_bingo')
      return
    }

    if (!categoryId) {
      setError('Please select a category.')
      return
    }
    setCreating(true)
    socket.emit('host:create', { categoryId: parseInt(categoryId), questionCount })
  }

  const handleStart = () => {
    if (players.length === 0) {
      setError('Wait for at least one player to join!')
      return
    }
    socket.emit('host:start_game', { gameId })
    navigate('/host/game')
  }

  if (!gameCreated) {
    return (
      <div className="page">
        <div className="card">
          <h2>Host a Game</h2>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label>Game Mode</label>
            <div className="btn-group" style={{ marginTop: 0 }}>
              <button
                type="button"
                className={gameMode === 'quiz' ? 'btn btn-primary' : 'btn btn-secondary'}
                onClick={() => setGameMode('quiz')}
              >
                🧠 Quiz
              </button>
              <button
                type="button"
                className={gameMode === 'draw' ? 'btn btn-primary' : 'btn btn-secondary'}
                onClick={() => setGameMode('draw')}
              >
                🎨 Draw
              </button>
              <button
                type="button"
                className={gameMode === 'word' ? 'btn btn-primary' : 'btn btn-secondary'}
                onClick={() => setGameMode('word')}
              >
                📝 Word Splash
              </button>
              <button
                type="button"
                className={gameMode === 'bingo' ? 'btn btn-primary' : 'btn btn-secondary'}
                onClick={() => setGameMode('bingo')}
              >
                🎱 Bingo
              </button>
            </div>
          </div>

          {gameMode === 'quiz' ? (
            <>
              <div className="form-group">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="qcount">Number of Questions</label>
                <select
                  id="qcount"
                  value={questionCount}
                  onChange={e => setQuestionCount(e.target.value)}
                >
                  {QUESTION_COUNT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </>
          ) : gameMode === 'draw' ? (
            <>
              <div className="form-group">
                <label htmlFor="topic">Topic</label>
                <select
                  id="topic"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                >
                  {topics.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="rounds">Number of Rounds</label>
                <select
                  id="rounds"
                  value={rounds}
                  onChange={e => setRounds(parseInt(e.target.value))}
                >
                  {ROUND_OPTIONS.map(r => (
                    <option key={r} value={r}>{r} Rounds</option>
                  ))}
                </select>
              </div>
            </>
          ) : gameMode === 'word' ? (
            <div className="form-group">
              <label htmlFor="wordTimeLimit">Time Limit</label>
              <select
                id="wordTimeLimit"
                value={wordTimeLimit}
                onChange={e => setWordTimeLimit(parseInt(e.target.value))}
              >
                {WORD_TIME_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-muted">
              Each player picks 9 numbers (1-90). Numbers are called every few seconds — shout "Line!" or "House!" when you've got it.
            </p>
          )}

          <button
            className="btn btn-primary mt-2"
            onClick={handleCreate}
            disabled={creating || (gameMode === 'quiz' ? !categoryId : gameMode === 'draw' ? !topic : false)}
          >
            {creating ? 'Creating...' : '🎲 Create Game'}
          </button>

          <div className="text-center mt-3">
            <Link to="/" className="nav-link">← Back to Home</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="card" style={{ textAlign: 'center' }}>
        <h2>Game Lobby</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <p className="text-muted">Share this PIN with players:</p>
        <div className="pin-display">{pin}</div>
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>
          Players go to <strong>hillyquiz.co.uk</strong> and enter this PIN
        </p>

        {qrCodeUrl && (
          <div className="mt-2" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <img src={qrCodeUrl} alt="QR code to join the game" style={{ borderRadius: '12px', background: '#fff', padding: '0.5rem' }} />
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Scan to join instantly</p>
          </div>
        )}

        <hr className="divider" />

        <h3>Players Joined: {players.length}</h3>
        {players.length === 0 ? (
          <p className="text-muted">Waiting for players...</p>
        ) : (
          <ul className="player-list" style={{ justifyContent: 'center' }}>
            {players.map(name => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        )}

        <button
          className="btn btn-success mt-4"
          onClick={handleStart}
          style={{ fontSize: '1.2rem', padding: '1rem' }}
        >
          ▶ Start Game
        </button>
      </div>
    </div>
  )
}

export default HostLobby
