import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import socket from '../socket.js'

const OPTION_COLORS = {
  A: '#7C3AED',
  B: '#0D9488',
  C: '#EA580C',
  D: '#D97706'
}

function HostGame() {
  const mode = localStorage.getItem('hilly-quiz-host-mode') || 'quiz'
  if (mode === 'draw') return <HostDrawGame />
  if (mode === 'word') return <HostWordGame />
  if (mode === 'bingo') return <HostBingoGame />
  if (mode === 'wordle') return <HostWordleGame />
  return <HostQuizGame />
}

const TILE_COLORS = { correct: '#22c55e', present: '#eab308', absent: '#3f3f52' }

function HostWordleGame() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('loading') // loading | playing | results
  const [roundInfo, setRoundInfo] = useState({ roundNumber: 0, totalRounds: 0 })
  const [timeLimit, setTimeLimit] = useState(180)
  const [countdown, setCountdown] = useState(null)
  const [progress, setProgress] = useState({ finishedCount: 0, totalPlayers: 0, players: [] })
  const [secretWord, setSecretWord] = useState('')
  const [results, setResults] = useState([])
  const gameIdRef = useRef(null)
  const countdownRef = useRef(null)

  useEffect(() => {
    const gameId = localStorage.getItem('hilly-quiz-host-gameId')
    if (!gameId) {
      navigate('/host')
      return
    }
    gameIdRef.current = gameId

    const onRound = ({ roundNumber, totalRounds, timeLimit: tl }) => {
      setRoundInfo({ roundNumber, totalRounds })
      setTimeLimit(tl)
      setCountdown(tl)
      setProgress({ finishedCount: 0, totalPlayers: 0, players: [] })
      setSecretWord('')
      setResults([])
      setPhase('playing')

      if (countdownRef.current) clearInterval(countdownRef.current)
      countdownRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(countdownRef.current)
            countdownRef.current = null
            return 0
          }
          return c - 1
        })
      }, 1000)
    }

    const onProgress = (data) => {
      setProgress(data)
    }

    const onResults = ({ secretWord: w, results: r }) => {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
      setSecretWord(w)
      setResults(r)
      setPhase('results')
    }

    const onEnd = ({ finalScores, leaderboard }) => {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
      localStorage.setItem('hilly-quiz-final-scores', JSON.stringify(finalScores))
      localStorage.setItem('hilly-quiz-leaderboard', JSON.stringify(leaderboard))
      navigate('/host/results')
    }

    socket.on('game:wordle_round', onRound)
    socket.on('game:wordle_progress', onProgress)
    socket.on('game:wordle_results', onResults)
    socket.on('game:end', onEnd)

    return () => {
      socket.off('game:wordle_round', onRound)
      socket.off('game:wordle_progress', onProgress)
      socket.off('game:wordle_results', onResults)
      socket.off('game:end', onEnd)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [navigate])

  const handleShowResults = () => {
    socket.emit('host:show_wordle_results', { gameId: gameIdRef.current })
  }

  const handleNextRound = () => {
    socket.emit('host:next_wordle_round', { gameId: gameIdRef.current })
  }

  const handleEndGame = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    socket.emit('host:end_game', { gameId: gameIdRef.current })
  }

  if (phase === 'loading') {
    return (
      <div className="page">
        <div className="spinner" />
        <p className="text-muted text-center">Loading...</p>
      </div>
    )
  }

  return (
    <div className="page-top">
      <div style={{ width: '100%', maxWidth: '800px', marginBottom: '1rem' }}>
        <div className="question-meta">
          <span style={{ fontSize: '1rem', color: 'white', fontWeight: '700' }}>
            🟩 Wordle — Round {roundInfo.roundNumber} / {roundInfo.totalRounds}
          </span>
          {phase === 'playing' && (
            <span className="answered-counter" style={{ margin: 0 }}>
              ⏱ {countdown}s
            </span>
          )}
        </div>
        <div className="progress-bar-container">
          <div
            className="progress-bar"
            style={{ width: `${phase === 'playing' && timeLimit > 0 ? (countdown / timeLimit) * 100 : 0}%` }}
          />
        </div>
      </div>

      {phase === 'playing' && (
        <>
          <p className="answered-counter">{progress.finishedCount} / {progress.totalPlayers} finished</p>

          <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            {progress.players.map(p => (
              <div key={p.nickname} className="score-item">
                <span className="name">{p.nickname}</span>
                <span className="points">
                  {p.finished ? '✅ Done' : `${p.guessCount} / 6 guesses`}
                </span>
              </div>
            ))}
          </div>

          <div style={{ width: '100%', maxWidth: '700px', marginTop: '1.5rem' }}>
            <div className="btn-group">
              {progress.finishedCount > 0 && progress.finishedCount === progress.totalPlayers ? (
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#22c55e', padding: '0.75rem 1.5rem' }}>
                  ✅ Everyone's done — revealing...
                </div>
              ) : (
                <button className="btn btn-primary" onClick={handleShowResults} style={{ fontSize: '1.1rem' }}>
                  📊 Show Results Now
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={handleEndGame} style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>
                End Game
              </button>
            </div>
          </div>
        </>
      )}

      {phase === 'results' && (
        <>
          <div className="question-box" style={{ fontSize: '1.6rem' }}>
            🏆 The word was: <strong style={{ letterSpacing: '0.2rem' }}>{secretWord.toUpperCase()}</strong>
          </div>

          <div style={{ width: '100%', maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {results.map(r => (
              <div key={r.socketId} className="card" style={{ padding: '1rem' }}>
                <div className="score-item" style={{ marginBottom: '0.5rem' }}>
                  <span className="name">{r.nickname}</span>
                  <span className="points">
                    {r.solved ? `Solved in ${r.guessCount}` : 'Not solved'} (+{r.roundScore}) · {r.totalScore} pts
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {r.guesses.map((g, gi) => (
                    <div key={gi} style={{ display: 'flex', gap: '2px' }}>
                      {g.feedback.map((f, fi) => (
                        <div key={fi} style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '4px',
                          background: TILE_COLORS[f],
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: '700',
                          color: 'white',
                          textTransform: 'uppercase'
                        }}>
                          {g.guess[fi]}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ width: '100%', maxWidth: '700px', marginTop: '1rem' }}>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={handleNextRound} style={{ fontSize: '1rem' }}>
                {roundInfo.roundNumber >= roundInfo.totalRounds ? '🏁 Finish Game' : '➡ Next Round'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleEndGame} style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>
                End Game
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function HostQuizGame() {
  const navigate = useNavigate()
  const [question, setQuestion] = useState(null)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [correctAnswer, setCorrectAnswer] = useState(null)
  const [scores, setScores] = useState([])
  const [phase, setPhase] = useState('question') // question | reveal
  const [countdown, setCountdown] = useState(null)
  const gameIdRef = useRef(null)
  const countdownRef = useRef(null)
  const autoRef = useRef(false) // tracks if reveal was auto-triggered

  useEffect(() => {
    const gameId = localStorage.getItem('hilly-quiz-host-gameId')
    if (!gameId) {
      navigate('/host')
      return
    }
    gameIdRef.current = gameId

    const onQuestion = (data) => {
      setQuestion(data)
      setAnsweredCount(0)
      setTotalPlayers(0)
      setCorrectAnswer(null)
      setScores([])
      setPhase('question')
      setCountdown(null)
      autoRef.current = false
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    }

    const onAnswerReceived = ({ answeredCount: ac, totalPlayers: tp }) => {
      setAnsweredCount(ac)
      setTotalPlayers(tp)
      // All players answered — auto-trigger show answer (same path as manual button click)
      if (ac > 0 && ac === tp) {
        autoRef.current = true
        socket.emit('host:show_answer', { gameId: gameIdRef.current })
      }
    }

    const onReveal = ({ correctAnswer: ca, scores: s }) => {
      setCorrectAnswer(ca)
      setScores(s)
      setPhase('reveal')

      // Start 2-second countdown to next question if this was auto-triggered
      if (autoRef.current) {
        autoRef.current = false
        if (countdownRef.current) clearInterval(countdownRef.current)
        let secs = 4
        setCountdown(secs)
        countdownRef.current = setInterval(() => {
          secs -= 1
          setCountdown(secs)
          if (secs <= 0) {
            clearInterval(countdownRef.current)
            countdownRef.current = null
            setCountdown(null)
            socket.emit('host:next_question', { gameId: gameIdRef.current })
          }
        }, 1000)
      }
    }

    const onEnd = ({ finalScores, leaderboard }) => {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
      localStorage.setItem('hilly-quiz-final-scores', JSON.stringify(finalScores))
      localStorage.setItem('hilly-quiz-leaderboard', JSON.stringify(leaderboard))
      navigate('/host/results')
    }

    socket.on('game:question', onQuestion)
    socket.on('game:answer_received', onAnswerReceived)
    socket.on('game:reveal', onReveal)
    socket.on('game:end', onEnd)

    return () => {
      socket.off('game:question', onQuestion)
      socket.off('game:answer_received', onAnswerReceived)
      socket.off('game:reveal', onReveal)
      socket.off('game:end', onEnd)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [navigate])

  const handleShowAnswer = () => {
    autoRef.current = false
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    setCountdown(null)
    socket.emit('host:show_answer', { gameId: gameIdRef.current })
  }

  const handleNextQuestion = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    setCountdown(null)
    socket.emit('host:next_question', { gameId: gameIdRef.current })
  }

  const handleEndGame = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    socket.emit('host:end_game', { gameId: gameIdRef.current })
  }

  if (!question) {
    return (
      <div className="page">
        <div className="spinner" />
        <p className="text-muted text-center">Loading question...</p>
      </div>
    )
  }

  const options = question.options || {}
  const optionKeys = Object.keys(options)
  const progress = question.totalQuestions > 0
    ? (question.questionNumber / question.totalQuestions) * 100
    : 0

  return (
    <div className="page-top">
      {/* Header */}
      <div style={{ width: '100%', maxWidth: '800px', marginBottom: '1rem' }}>
        <div className="question-meta">
          <span style={{ fontSize: '1rem', color: 'white', fontWeight: '700' }}>
            Question {question.questionNumber} / {question.totalQuestions}
          </span>
          <span className="answered-counter" style={{ margin: 0 }}>
            {answeredCount} / {totalPlayers} answered
          </span>
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="question-box" style={{ fontSize: '1.6rem' }}>
        {question.text}
      </div>

      {/* Answer Options */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          width: '100%',
          maxWidth: '700px',
          marginTop: '0.5rem'
        }}
      >
        {optionKeys.map(key => {
          const isCorrect = phase === 'reveal' && key === correctAnswer
          const isWrong = phase === 'reveal' && key !== correctAnswer
          return (
            <div
              key={key}
              style={{
                background: OPTION_COLORS[key] || '#555',
                padding: '1.25rem',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                fontSize: '1.15rem',
                fontWeight: '700',
                color: 'white',
                minHeight: '80px',
                opacity: isWrong ? 0.4 : 1,
                outline: isCorrect ? '4px solid #22c55e' : 'none',
                boxShadow: isCorrect ? '0 0 20px rgba(34, 197, 94, 0.5)' : '0 4px 15px rgba(0,0,0,0.3)',
                transition: 'all 0.3s ease',
                position: 'relative'
              }}
            >
              <span style={{ fontSize: '0.85rem', marginRight: '0.5rem', opacity: 0.8 }}>{key}.</span>
              {options[key]}
              {isCorrect && (
                <span style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '1.5rem' }}>✅</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Controls */}
      <div style={{ width: '100%', maxWidth: '700px', marginTop: '2rem' }}>
        {phase === 'question' && (
          <div className="btn-group">
            {answeredCount > 0 && answeredCount === totalPlayers ? (
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#22c55e', padding: '0.75rem 1.5rem' }}>
                ✅ All answered — revealing...
              </div>
            ) : (
              <button className="btn btn-primary" onClick={handleShowAnswer} style={{ fontSize: '1.1rem' }}>
                👁 Show Answer
              </button>
            )}
            <button className="btn btn-danger btn-sm" onClick={handleEndGame} style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>
              End Game
            </button>
          </div>
        )}

        {phase === 'reveal' && (
          <>
            <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Current Scores</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {scores.slice(0, 5).map((s, i) => (
                  <div key={s.nickname} className="score-item" style={{ padding: '0.5rem 1rem' }}>
                    <span className="rank">{i + 1}.</span>
                    <span className="name">{s.nickname}</span>
                    <span className="points">{s.score} pts</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="btn-group">
              {countdown !== null && (
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#a78bfa', padding: '0.75rem 1.5rem' }}>
                  ⏩ Next in {countdown}s
                </div>
              )}
              <button className="btn btn-primary" onClick={handleNextQuestion} style={{ fontSize: '1rem' }}>
                {countdown !== null ? 'Skip →' : '➡ Next Question'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleEndGame} style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>
                End Game
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function HostDrawGame() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('loading') // loading | drawing | voting | results
  const [word, setWord] = useState('')
  const [roundInfo, setRoundInfo] = useState({ roundNumber: 0, totalRounds: 0 })
  const [submitted, setSubmitted] = useState({ count: 0, total: 0 })
  const [drawings, setDrawings] = useState([])
  const [voted, setVoted] = useState({ count: 0, total: 0 })
  const [results, setResults] = useState([])
  const [scores, setScores] = useState([])
  const gameIdRef = useRef(null)

  useEffect(() => {
    const gameId = localStorage.getItem('hilly-quiz-host-gameId')
    if (!gameId) {
      navigate('/host')
      return
    }
    gameIdRef.current = gameId

    const onDrawRound = ({ word: w, roundNumber, totalRounds }) => {
      setWord(w)
      setRoundInfo({ roundNumber, totalRounds })
      setSubmitted({ count: 0, total: 0 })
      setDrawings([])
      setVoted({ count: 0, total: 0 })
      setResults([])
      setPhase('drawing')
    }

    const onDrawingReceived = ({ submittedCount, totalPlayers }) => {
      setSubmitted({ count: submittedCount, total: totalPlayers })
    }

    const onVotePhase = ({ drawings: d, totalPlayers }) => {
      setDrawings(d)
      setVoted({ count: 0, total: totalPlayers })
      setPhase('voting')
    }

    const onVoteReceived = ({ votedCount, totalPlayers }) => {
      setVoted({ count: votedCount, total: totalPlayers })
    }

    const onDrawResults = ({ results: r, scores: s }) => {
      setResults(r)
      setScores(s)
      setPhase('results')
    }

    const onEnd = ({ finalScores, leaderboard }) => {
      localStorage.setItem('hilly-quiz-final-scores', JSON.stringify(finalScores))
      localStorage.setItem('hilly-quiz-leaderboard', JSON.stringify(leaderboard))
      navigate('/host/results')
    }

    socket.on('game:draw_round', onDrawRound)
    socket.on('game:drawing_received', onDrawingReceived)
    socket.on('game:vote_phase', onVotePhase)
    socket.on('game:vote_received', onVoteReceived)
    socket.on('game:draw_results', onDrawResults)
    socket.on('game:end', onEnd)

    return () => {
      socket.off('game:draw_round', onDrawRound)
      socket.off('game:drawing_received', onDrawingReceived)
      socket.off('game:vote_phase', onVotePhase)
      socket.off('game:vote_received', onVoteReceived)
      socket.off('game:draw_results', onDrawResults)
      socket.off('game:end', onEnd)
    }
  }, [navigate])

  const handleStartVoting = () => {
    socket.emit('host:start_voting', { gameId: gameIdRef.current })
  }

  const handleShowResults = () => {
    socket.emit('host:show_draw_results', { gameId: gameIdRef.current })
  }

  const handleNextRound = () => {
    socket.emit('host:next_round', { gameId: gameIdRef.current })
  }

  const handleEndGame = () => {
    socket.emit('host:end_game', { gameId: gameIdRef.current })
  }

  if (phase === 'loading') {
    return (
      <div className="page">
        <div className="spinner" />
        <p className="text-muted text-center">Loading...</p>
      </div>
    )
  }

  return (
    <div className="page-top">
      <div style={{ width: '100%', maxWidth: '800px', marginBottom: '1rem' }}>
        <div className="question-meta">
          <span style={{ fontSize: '1rem', color: 'white', fontWeight: '700' }}>
            Round {roundInfo.roundNumber} / {roundInfo.totalRounds}
          </span>
        </div>
        <div className="progress-bar-container">
          <div
            className="progress-bar"
            style={{ width: `${roundInfo.totalRounds > 0 ? (roundInfo.roundNumber / roundInfo.totalRounds) * 100 : 0}%` }}
          />
        </div>
      </div>

      {phase === 'drawing' && (
        <>
          <div className="question-box" style={{ fontSize: '1.8rem' }}>
            🎨 Draw: <strong>{word}</strong>
          </div>
          <p className="answered-counter">{submitted.count} / {submitted.total} submitted</p>
          <div style={{ width: '100%', maxWidth: '700px', marginTop: '1rem' }}>
            <div className="btn-group">
              {submitted.count > 0 && submitted.count === submitted.total ? (
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#22c55e', padding: '0.75rem 1.5rem' }}>
                  ✅ Everyone's done — starting voting...
                </div>
              ) : (
                <button className="btn btn-primary" onClick={handleStartVoting} style={{ fontSize: '1.1rem' }}>
                  🗳 Start Voting Now
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={handleEndGame} style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>
                End Game
              </button>
            </div>
          </div>
        </>
      )}

      {phase === 'voting' && (
        <>
          <div className="question-box" style={{ fontSize: '1.6rem' }}>
            🗳 Players are voting for their favourite "{word}" drawing
          </div>
          <p className="answered-counter">{voted.count} / {voted.total} voted</p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '1rem',
              width: '100%',
              maxWidth: '700px',
              marginTop: '1rem'
            }}
          >
            {drawings.map(d => (
              <img
                key={d.socketId}
                src={d.image}
                alt="Drawing"
                style={{ width: '100%', borderRadius: '12px', border: '2px solid rgba(255,255,255,0.15)' }}
              />
            ))}
          </div>

          <div style={{ width: '100%', maxWidth: '700px', marginTop: '1.5rem' }}>
            <div className="btn-group">
              {voted.count > 0 && voted.count === voted.total ? (
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#22c55e', padding: '0.75rem 1.5rem' }}>
                  ✅ Everyone's voted — showing results...
                </div>
              ) : (
                <button className="btn btn-primary" onClick={handleShowResults} style={{ fontSize: '1.1rem' }}>
                  📊 Show Results Now
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={handleEndGame} style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>
                End Game
              </button>
            </div>
          </div>
        </>
      )}

      {phase === 'results' && (
        <>
          <div className="question-box" style={{ fontSize: '1.6rem' }}>
            🏆 Results for "{word}"
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '1rem',
              width: '100%',
              maxWidth: '700px',
              marginTop: '1rem'
            }}
          >
            {results.map((r, i) => (
              <div key={r.socketId} style={{ textAlign: 'center' }}>
                <img
                  src={r.image}
                  alt="Drawing"
                  style={{
                    width: '100%',
                    borderRadius: '12px',
                    border: i === 0 && r.votes > 0 ? '3px solid #fbbf24' : '2px solid rgba(255,255,255,0.15)'
                  }}
                />
                <div style={{ marginTop: '0.5rem', fontWeight: '700' }}>{r.nickname}</div>
                <div style={{ color: '#fbbf24', fontWeight: '700' }}>
                  {r.votes} vote{r.votes !== 1 ? 's' : ''}
                  {i === 0 && r.votes > 0 ? ' 🏆' : ''}
                </div>
              </div>
            ))}
          </div>

          <div className="card mt-3" style={{ marginBottom: '1rem', padding: '1rem', width: '100%', maxWidth: '700px' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Current Scores</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {scores.slice(0, 5).map((s, i) => (
                <div key={s.nickname} className="score-item" style={{ padding: '0.5rem 1rem' }}>
                  <span className="rank">{i + 1}.</span>
                  <span className="name">{s.nickname}</span>
                  <span className="points">{s.score} pts</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ width: '100%', maxWidth: '700px' }}>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={handleNextRound} style={{ fontSize: '1rem' }}>
                {roundInfo.roundNumber >= roundInfo.totalRounds ? '🏁 Finish Game' : '➡ Next Round'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleEndGame} style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>
                End Game
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function HostWordGame() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('loading') // loading | playing | results
  const [baseWord, setBaseWord] = useState('')
  const [timeLimit, setTimeLimit] = useState(120)
  const [countdown, setCountdown] = useState(null)
  const [submitted, setSubmitted] = useState({ count: 0, total: 0 })
  const [results, setResults] = useState([])
  const gameIdRef = useRef(null)
  const countdownRef = useRef(null)

  useEffect(() => {
    const gameId = localStorage.getItem('hilly-quiz-host-gameId')
    if (!gameId) {
      navigate('/host')
      return
    }
    gameIdRef.current = gameId

    const onWordRound = ({ baseWord: w, timeLimit: tl }) => {
      setBaseWord(w)
      setTimeLimit(tl)
      setCountdown(tl)
      setSubmitted({ count: 0, total: 0 })
      setResults([])
      setPhase('playing')

      if (countdownRef.current) clearInterval(countdownRef.current)
      countdownRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(countdownRef.current)
            countdownRef.current = null
            return 0
          }
          return c - 1
        })
      }, 1000)
    }

    const onWordsReceived = ({ submittedCount, totalPlayers }) => {
      setSubmitted({ count: submittedCount, total: totalPlayers })
    }

    const onWordResults = ({ baseWord: w, results: r }) => {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
      setBaseWord(w)
      setResults(r)
      setPhase('results')
    }

    const onEnd = ({ finalScores, leaderboard }) => {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
      localStorage.setItem('hilly-quiz-final-scores', JSON.stringify(finalScores))
      localStorage.setItem('hilly-quiz-leaderboard', JSON.stringify(leaderboard))
      navigate('/host/results')
    }

    socket.on('game:word_round', onWordRound)
    socket.on('game:words_received', onWordsReceived)
    socket.on('game:word_results', onWordResults)
    socket.on('game:end', onEnd)

    return () => {
      socket.off('game:word_round', onWordRound)
      socket.off('game:words_received', onWordsReceived)
      socket.off('game:word_results', onWordResults)
      socket.off('game:end', onEnd)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [navigate])

  const handleShowResults = () => {
    socket.emit('host:show_word_results', { gameId: gameIdRef.current })
  }

  const handleEndGame = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    socket.emit('host:end_game', { gameId: gameIdRef.current })
  }

  if (phase === 'loading') {
    return (
      <div className="page">
        <div className="spinner" />
        <p className="text-muted text-center">Loading...</p>
      </div>
    )
  }

  return (
    <div className="page-top">
      {phase === 'playing' && (
        <>
          <div style={{ width: '100%', maxWidth: '800px', marginBottom: '1rem' }}>
            <div className="question-meta">
              <span style={{ fontSize: '1rem', color: 'white', fontWeight: '700' }}>
                📝 Word Splash
              </span>
              <span className="answered-counter" style={{ margin: 0 }}>
                ⏱ {countdown}s
              </span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${timeLimit > 0 ? (countdown / timeLimit) * 100 : 0}%` }} />
            </div>
          </div>

          <div className="question-box" style={{ fontSize: '2rem', letterSpacing: '0.3rem' }}>
            {baseWord}
          </div>

          <p className="answered-counter">{submitted.count} / {submitted.total} submitted</p>

          <div style={{ width: '100%', maxWidth: '700px', marginTop: '1rem' }}>
            <div className="btn-group">
              {submitted.count > 0 && submitted.count === submitted.total ? (
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#22c55e', padding: '0.75rem 1.5rem' }}>
                  ✅ Everyone's done — showing results...
                </div>
              ) : (
                <button className="btn btn-primary" onClick={handleShowResults} style={{ fontSize: '1.1rem' }}>
                  📊 Show Results Now
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={handleEndGame} style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>
                End Game
              </button>
            </div>
          </div>
        </>
      )}

      {phase === 'results' && (
        <>
          <div className="question-box" style={{ fontSize: '1.6rem' }}>
            🏆 Results — base word: <strong>{baseWord}</strong>
          </div>

          <div className="card mt-3" style={{ marginBottom: '1rem', padding: '1rem', width: '100%', maxWidth: '700px' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Scores</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {results.map((r, i) => (
                <div key={r.socketId} style={{ padding: '0.5rem 1rem' }}>
                  <div className="score-item">
                    <span className="rank">{i + 1}.</span>
                    <span className="name">{r.nickname}</span>
                    <span className="points">{r.totalScore} pts (+{r.roundScore})</span>
                  </div>
                  {r.words.length > 0 && (
                    <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem', paddingLeft: '1.5rem' }}>
                      {r.words.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ width: '100%', maxWidth: '700px' }}>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={handleEndGame} style={{ fontSize: '1rem' }}>
                🏁 Finish Game
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function HostBingoGame() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('loading') // loading | picking | calling | results
  const [pickProgress, setPickProgress] = useState({ count: 0, total: 0 })
  const [calledNumbers, setCalledNumbers] = useState([])
  const [latestNumber, setLatestNumber] = useState(null)
  const [winners, setWinners] = useState([])
  const [scores, setScores] = useState([])
  const [cheatAlert, setCheatAlert] = useState(null)
  const gameIdRef = useRef(null)
  const cheatTimeoutRef = useRef(null)

  useEffect(() => {
    const gameId = localStorage.getItem('hilly-quiz-host-gameId')
    if (!gameId) {
      navigate('/host')
      return
    }
    gameIdRef.current = gameId

    const onPick = () => {
      setPickProgress({ count: 0, total: 0 })
      setCalledNumbers([])
      setLatestNumber(null)
      setWinners([])
      setScores([])
      setPhase('picking')
    }

    const onPicksReceived = ({ submittedCount, totalPlayers }) => {
      setPickProgress({ count: submittedCount, total: totalPlayers })
    }

    const onCallingStart = () => {
      setPhase('calling')
    }

    const onNumber = ({ number, calledNumbers: cn }) => {
      setLatestNumber(number)
      setCalledNumbers(cn)
    }

    const onWin = ({ type, nickname, points }) => {
      setWinners(w => [...w, { type, nickname, points }])
    }

    const onCheat = ({ nickname }) => {
      setCheatAlert(nickname)
      if (cheatTimeoutRef.current) clearTimeout(cheatTimeoutRef.current)
      cheatTimeoutRef.current = setTimeout(() => setCheatAlert(null), 4000)
    }

    const onResults = ({ scores: s, calledNumbers: cn }) => {
      setCalledNumbers(cn)
      setScores(s)
      setPhase('results')
    }

    const onEnd = ({ finalScores, leaderboard }) => {
      localStorage.setItem('hilly-quiz-final-scores', JSON.stringify(finalScores))
      localStorage.setItem('hilly-quiz-leaderboard', JSON.stringify(leaderboard))
      navigate('/host/results')
    }

    socket.on('game:bingo_pick', onPick)
    socket.on('game:bingo_picks_received', onPicksReceived)
    socket.on('game:bingo_calling_start', onCallingStart)
    socket.on('game:bingo_number', onNumber)
    socket.on('game:bingo_win', onWin)
    socket.on('game:bingo_cheat', onCheat)
    socket.on('game:bingo_results', onResults)
    socket.on('game:end', onEnd)

    return () => {
      socket.off('game:bingo_pick', onPick)
      socket.off('game:bingo_picks_received', onPicksReceived)
      socket.off('game:bingo_calling_start', onCallingStart)
      socket.off('game:bingo_number', onNumber)
      socket.off('game:bingo_win', onWin)
      socket.off('game:bingo_cheat', onCheat)
      socket.off('game:bingo_results', onResults)
      socket.off('game:end', onEnd)
      if (cheatTimeoutRef.current) clearTimeout(cheatTimeoutRef.current)
    }
  }, [navigate])

  const handleShowResults = () => {
    socket.emit('host:show_bingo_results', { gameId: gameIdRef.current })
  }

  const handleEndGame = () => {
    socket.emit('host:end_game', { gameId: gameIdRef.current })
  }

  if (phase === 'loading') {
    return (
      <div className="page">
        <div className="spinner" />
        <p className="text-muted text-center">Loading...</p>
      </div>
    )
  }

  return (
    <div className="page-top">
      {cheatAlert && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          textAlign: 'center',
          padding: '1rem'
        }}>
          <div style={{ fontSize: '4rem' }}>🚨</div>
          <div
            className="cheat-shake"
            style={{ fontSize: '3rem', fontWeight: '800', color: '#ef4444', lineHeight: 1.2 }}
          >
            {cheatAlert} IS A CHEAT!
          </div>
        </div>
      )}

      {phase === 'picking' && (
        <>
          <div className="question-box" style={{ fontSize: '1.6rem' }}>
            🎱 Players are choosing their 9 numbers...
          </div>
          <p className="answered-counter">{pickProgress.count} / {pickProgress.total} ready</p>
          <div className="btn-group" style={{ width: '100%', maxWidth: '700px', marginTop: '1rem' }}>
            <button className="btn btn-danger btn-sm" onClick={handleEndGame} style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>
              End Game
            </button>
          </div>
        </>
      )}

      {phase === 'calling' && (
        <>
          <div className="question-box" style={{ fontSize: '1.6rem' }}>
            🎱 Bingo!
          </div>

          {latestNumber !== null && (
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: '#7C3AED',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3rem',
              fontWeight: '800',
              color: 'white',
              margin: '1rem auto',
              boxShadow: '0 4px 20px rgba(124,58,237,0.5)'
            }}>
              {latestNumber}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', maxWidth: '700px', marginTop: '0.5rem' }}>
            {calledNumbers.map(n => (
              <span key={n} style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '999px',
                padding: '0.3rem 0.7rem',
                fontSize: '0.9rem',
                fontWeight: '700'
              }}>
                {n}
              </span>
            ))}
          </div>

          {winners.length > 0 && (
            <div className="card mt-3" style={{ padding: '1rem', width: '100%', maxWidth: '700px' }}>
              {winners.map((w, i) => (
                <div key={i} style={{ fontWeight: '700', color: '#fbbf24' }}>
                  {w.type === 'line' ? '➖ Line' : '🏠 Full House'}: {w.nickname} (+{w.points} pts)
                </div>
              ))}
            </div>
          )}

          <div className="btn-group" style={{ width: '100%', maxWidth: '700px', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={handleShowResults} style={{ fontSize: '1.1rem' }}>
              📊 Show Results Now
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleEndGame} style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>
              End Game
            </button>
          </div>
        </>
      )}

      {phase === 'results' && (
        <>
          <div className="question-box" style={{ fontSize: '1.6rem' }}>
            🏆 Bingo Results
          </div>

          <div className="card mt-3" style={{ marginBottom: '1rem', padding: '1rem', width: '100%', maxWidth: '700px' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Scores</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {scores.map((s, i) => (
                <div key={s.nickname} className="score-item" style={{ padding: '0.5rem 1rem' }}>
                  <span className="rank">{i + 1}.</span>
                  <span className="name">{s.nickname}</span>
                  <span className="points">{s.score} pts</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ width: '100%', maxWidth: '700px' }}>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={handleEndGame} style={{ fontSize: '1rem' }}>
                🏁 Finish Game
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default HostGame
