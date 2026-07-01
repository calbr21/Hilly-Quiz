import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import socket from '../socket.js'
import DrawCanvas from '../components/DrawCanvas.jsx'

const OPTION_COLORS = {
  A: 'btn-a',
  B: 'btn-b',
  C: 'btn-c',
  D: 'btn-d'
}

const OPTION_EMOJIS = {
  A: '🟣',
  B: '🟦',
  C: '🟧',
  D: '🟨'
}

function PlayerGame() {
  const navigate = useNavigate()
  const [gameState, setGameState] = useState('waiting') // waiting | question | answered | reveal | end
  const [question, setQuestion] = useState(null)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [correctAnswer, setCorrectAnswer] = useState(null)
  const [scores, setScores] = useState([])
  const [finalScores, setFinalScores] = useState([])
  const [myPosition, setMyPosition] = useState(null)
  const [myScore, setMyScore] = useState(0)
  const [error, setError] = useState('')
  const gameIdRef = useRef(null)
  const nicknameRef = useRef(null)

  // Draw mode state
  const [drawWord, setDrawWord] = useState('')
  const [drawRoundInfo, setDrawRoundInfo] = useState({ roundNumber: 0, totalRounds: 0, timeLimit: 60 })
  const [drawSubmitted, setDrawSubmitted] = useState(false)
  const [voteDrawings, setVoteDrawings] = useState([])
  const [votedFor, setVotedFor] = useState(null)
  const [drawResults, setDrawResults] = useState([])
  const [drawTimeLeft, setDrawTimeLeft] = useState(60)
  const canvasRef = useRef(null)
  const drawTimerRef = useRef(null)

  // Word Splash mode state
  const [wordBase, setWordBase] = useState('')
  const [wordTimeLeft, setWordTimeLeft] = useState(120)
  const [wordEntries, setWordEntries] = useState([])
  const [wordInput, setWordInput] = useState('')
  const [wordSubmitted, setWordSubmitted] = useState(false)
  const [wordScore, setWordScore] = useState(null)
  const [wordResults, setWordResults] = useState([])
  const wordTimerRef = useRef(null)

  // Bingo mode state
  const [bingoPickTime, setBingoPickTime] = useState(30)
  const [bingoNumbers, setBingoNumbers] = useState([])
  const [bingoPickInput, setBingoPickInput] = useState('')
  const [bingoSubmitted, setBingoSubmitted] = useState(false)
  const [bingoCalled, setBingoCalled] = useState([])
  const [bingoLatest, setBingoLatest] = useState(null)
  const [bingoWinners, setBingoWinners] = useState([])
  const [bingoLineClaimed, setBingoLineClaimed] = useState(false)
  const [bingoFullHouseClaimed, setBingoFullHouseClaimed] = useState(false)
  const [bingoScores, setBingoScores] = useState([])
  const [bingoMarked, setBingoMarked] = useState([])
  const bingoPickTimerRef = useRef(null)

  // Wordle mode state
  const [wordleRoundInfo, setWordleRoundInfo] = useState({ roundNumber: 0, totalRounds: 0, timeLimit: 180, maxGuesses: 6, wordLength: 5 })
  const [wordleTimeLeft, setWordleTimeLeft] = useState(180)
  const [wordleGuesses, setWordleGuesses] = useState([]) // [{ guess, feedback }]
  const [wordleCurrent, setWordleCurrent] = useState('')
  const [wordleFinished, setWordleFinished] = useState(false)
  const [wordleSolved, setWordleSolved] = useState(false)
  const [wordleError, setWordleError] = useState('')
  const [wordleSecretWord, setWordleSecretWord] = useState('')
  const [wordleResults, setWordleResults] = useState([])
  const wordleTimerRef = useRef(null)
  const wordleErrorTimerRef = useRef(null)
  const wordlePendingGuessRef = useRef('')

  useEffect(() => {
    const gameId = localStorage.getItem('hilly-quiz-gameId')
    const nickname = localStorage.getItem('hilly-quiz-nickname')

    if (!gameId || !nickname) {
      navigate('/join')
      return
    }

    gameIdRef.current = gameId
    nicknameRef.current = nickname

    const onQuestion = (data) => {
      setQuestion(data)
      setSelectedAnswer(null)
      setCorrectAnswer(null)
      setGameState('question')
    }

    const onReveal = ({ correctAnswer: ca, scores: s }) => {
      setCorrectAnswer(ca)
      setScores(s)

      // Find my position
      const me = s.find(p => p.nickname === nicknameRef.current)
      if (me) {
        setMyScore(me.score)
        const pos = s.findIndex(p => p.nickname === nicknameRef.current) + 1
        setMyPosition(pos)
      }

      setGameState('reveal')
    }

    const onEnd = ({ finalScores: fs }) => {
      if (drawTimerRef.current) { clearInterval(drawTimerRef.current); drawTimerRef.current = null }
      setFinalScores(fs)

      const pos = fs.findIndex(p => p.nickname === nicknameRef.current) + 1
      setMyPosition(pos)
      const me = fs.find(p => p.nickname === nicknameRef.current)
      if (me) setMyScore(me.score)

      setGameState('end')
    }

    // Draw mode
    const onDrawRound = ({ word, roundNumber, totalRounds, timeLimit }) => {
      setDrawWord(word)
      setDrawRoundInfo({ roundNumber, totalRounds, timeLimit })
      setDrawSubmitted(false)
      setVoteDrawings([])
      setVotedFor(null)
      setDrawResults([])
      setDrawTimeLeft(timeLimit)
      if (canvasRef.current) canvasRef.current.clear()
      setGameState('draw_drawing')

      if (drawTimerRef.current) clearInterval(drawTimerRef.current)
      drawTimerRef.current = setInterval(() => {
        setDrawTimeLeft(t => {
          if (t <= 1) {
            clearInterval(drawTimerRef.current)
            drawTimerRef.current = null
            return 0
          }
          return t - 1
        })
      }, 1000)
    }

    const onVotePhase = ({ drawings }) => {
      if (drawTimerRef.current) { clearInterval(drawTimerRef.current); drawTimerRef.current = null }
      setVoteDrawings(drawings)
      setVotedFor(null)
      setGameState('draw_voting')
    }

    const onDrawResults = ({ results, scores: s }) => {
      setDrawResults(results)
      const me = s.find(p => p.nickname === nicknameRef.current)
      if (me) setMyScore(me.score)
      setGameState('draw_reveal')
    }

    // Word Splash mode
    const onWordRound = ({ baseWord, timeLimit }) => {
      setWordBase(baseWord)
      setWordTimeLeft(timeLimit)
      setWordEntries([])
      setWordInput('')
      setWordSubmitted(false)
      setWordScore(null)
      setWordResults([])
      setGameState('word_play')

      if (wordTimerRef.current) clearInterval(wordTimerRef.current)
      wordTimerRef.current = setInterval(() => {
        setWordTimeLeft(t => {
          if (t <= 1) {
            clearInterval(wordTimerRef.current)
            wordTimerRef.current = null
            return 0
          }
          return t - 1
        })
      }, 1000)
    }

    const onWordScore = (result) => {
      setWordScore(result)
    }

    const onWordResults = ({ baseWord, results }) => {
      if (wordTimerRef.current) { clearInterval(wordTimerRef.current); wordTimerRef.current = null }
      setWordBase(baseWord)
      setWordResults(results)
      const me = results.find(p => p.nickname === nicknameRef.current)
      if (me) setMyScore(me.totalScore)
      setGameState('word_reveal')
    }

    // Bingo mode
    const onBingoPick = ({ pickTime }) => {
      setBingoPickTime(pickTime)
      setBingoNumbers([])
      setBingoPickInput('')
      setBingoSubmitted(false)
      setBingoCalled([])
      setBingoLatest(null)
      setBingoWinners([])
      setBingoLineClaimed(false)
      setBingoFullHouseClaimed(false)
      setBingoScores([])
      setBingoMarked([])
      setGameState('bingo_pick')

      if (bingoPickTimerRef.current) clearInterval(bingoPickTimerRef.current)
      bingoPickTimerRef.current = setInterval(() => {
        setBingoPickTime(t => {
          if (t <= 1) {
            clearInterval(bingoPickTimerRef.current)
            bingoPickTimerRef.current = null
            return 0
          }
          return t - 1
        })
      }, 1000)
    }

    const onBingoNumbersConfirmed = ({ numbers }) => {
      if (bingoPickTimerRef.current) { clearInterval(bingoPickTimerRef.current); bingoPickTimerRef.current = null }
      setBingoNumbers(numbers)
      setBingoSubmitted(true)
    }

    const onBingoCallingStart = () => {
      setGameState('bingo_play')
    }

    const onBingoNumber = ({ number, calledNumbers: cn }) => {
      setBingoLatest(number)
      setBingoCalled(cn)
    }

    const onBingoWin = ({ type, nickname }) => {
      setBingoWinners(w => [...w, { type, nickname }])
      if (nickname === nicknameRef.current) {
        if (type === 'line') setBingoLineClaimed(true)
        if (type === 'fullhouse') setBingoFullHouseClaimed(true)
      }
    }

    const onBingoClaimResult = ({ type, success }) => {
      if (success) {
        if (type === 'line') setBingoLineClaimed(true)
        if (type === 'fullhouse') setBingoFullHouseClaimed(true)
      }
    }

    const onBingoResults = ({ scores: s }) => {
      setBingoScores(s)
      const me = s.find(p => p.nickname === nicknameRef.current)
      if (me) setMyScore(me.score)
      setGameState('bingo_reveal')
    }

    // Wordle mode
    const onWordleRound = (info) => {
      setWordleRoundInfo(info)
      setWordleTimeLeft(info.timeLimit)
      setWordleGuesses([])
      setWordleCurrent('')
      setWordleFinished(false)
      setWordleSolved(false)
      setWordleError('')
      setWordleSecretWord('')
      setWordleResults([])
      setGameState('wordle_play')

      if (wordleTimerRef.current) clearInterval(wordleTimerRef.current)
      wordleTimerRef.current = setInterval(() => {
        setWordleTimeLeft(t => {
          if (t <= 1) {
            clearInterval(wordleTimerRef.current)
            wordleTimerRef.current = null
            return 0
          }
          return t - 1
        })
      }, 1000)
    }

    const onGuessResult = (result) => {
      if (result.error) {
        setWordleError(
          result.error === 'not_a_word' ? "That's not a word!" :
          result.error === 'invalid_length' ? 'Guess must be 5 letters.' :
          ''
        )
        if (wordleErrorTimerRef.current) clearTimeout(wordleErrorTimerRef.current)
        wordleErrorTimerRef.current = setTimeout(() => setWordleError(''), 2000)
        return
      }
      setWordleGuesses(g => [...g, { guess: wordlePendingGuessRef.current, feedback: result.feedback }])
      setWordleCurrent('')
      if (result.finished) {
        setWordleFinished(true)
        setWordleSolved(result.solved)
        if (wordleTimerRef.current) { clearInterval(wordleTimerRef.current); wordleTimerRef.current = null }
      }
    }

    const onWordleResults = ({ secretWord, results }) => {
      if (wordleTimerRef.current) { clearInterval(wordleTimerRef.current); wordleTimerRef.current = null }
      setWordleSecretWord(secretWord)
      setWordleResults(results)
      const me = results.find(p => p.nickname === nicknameRef.current)
      if (me) setMyScore(me.totalScore)
      setGameState('wordle_reveal')
    }

    socket.on('game:question', onQuestion)
    socket.on('game:reveal', onReveal)
    socket.on('game:end', onEnd)
    socket.on('game:draw_round', onDrawRound)
    socket.on('game:vote_phase', onVotePhase)
    socket.on('game:draw_results', onDrawResults)
    socket.on('game:word_round', onWordRound)
    socket.on('player:word_score', onWordScore)
    socket.on('game:word_results', onWordResults)
    socket.on('game:bingo_pick', onBingoPick)
    socket.on('player:bingo_numbers_confirmed', onBingoNumbersConfirmed)
    socket.on('game:bingo_calling_start', onBingoCallingStart)
    socket.on('game:bingo_number', onBingoNumber)
    socket.on('game:bingo_win', onBingoWin)
    socket.on('player:bingo_claim_result', onBingoClaimResult)
    socket.on('game:bingo_results', onBingoResults)
    socket.on('game:wordle_round', onWordleRound)
    socket.on('player:guess_result', onGuessResult)
    socket.on('game:wordle_results', onWordleResults)

    return () => {
      socket.off('game:question', onQuestion)
      socket.off('game:reveal', onReveal)
      socket.off('game:end', onEnd)
      socket.off('game:draw_round', onDrawRound)
      socket.off('game:vote_phase', onVotePhase)
      socket.off('game:draw_results', onDrawResults)
      socket.off('game:word_round', onWordRound)
      socket.off('player:word_score', onWordScore)
      socket.off('game:word_results', onWordResults)
      socket.off('game:bingo_pick', onBingoPick)
      socket.off('player:bingo_numbers_confirmed', onBingoNumbersConfirmed)
      socket.off('game:bingo_calling_start', onBingoCallingStart)
      socket.off('game:bingo_number', onBingoNumber)
      socket.off('game:bingo_win', onBingoWin)
      socket.off('player:bingo_claim_result', onBingoClaimResult)
      socket.off('game:bingo_results', onBingoResults)
      socket.off('game:wordle_round', onWordleRound)
      socket.off('player:guess_result', onGuessResult)
      socket.off('game:wordle_results', onWordleResults)
      if (drawTimerRef.current) clearInterval(drawTimerRef.current)
      if (wordTimerRef.current) clearInterval(wordTimerRef.current)
      if (bingoPickTimerRef.current) clearInterval(bingoPickTimerRef.current)
      if (wordleTimerRef.current) clearInterval(wordleTimerRef.current)
      if (wordleErrorTimerRef.current) clearTimeout(wordleErrorTimerRef.current)
    }
  }, [navigate])

  const handleAnswer = (answer) => {
    if (gameState !== 'question' || selectedAnswer) return

    setSelectedAnswer(answer)
    setGameState('answered')

    socket.emit('player:answer', {
      gameId: gameIdRef.current,
      questionId: question.questionId,
      answer
    })
  }

  const handlePlayAgain = () => {
    localStorage.removeItem('hilly-quiz-gameId')
    navigate('/join')
  }

  const handleSubmitDrawing = () => {
    if (drawSubmitted || !canvasRef.current) return
    setDrawSubmitted(true)
    if (drawTimerRef.current) { clearInterval(drawTimerRef.current); drawTimerRef.current = null }

    const drawing = canvasRef.current.getDataUrl()
    socket.emit('player:submit_drawing', {
      gameId: gameIdRef.current,
      drawing
    })
  }

  const handleVote = (socketId) => {
    if (votedFor) return
    setVotedFor(socketId)
    socket.emit('player:vote', {
      gameId: gameIdRef.current,
      votedFor: socketId
    })
  }

  // Auto-submit when the drawing timer runs out
  useEffect(() => {
    if (gameState === 'draw_drawing' && drawTimeLeft === 0 && !drawSubmitted) {
      handleSubmitDrawing()
    }
  }, [drawTimeLeft, gameState, drawSubmitted])

  const handleAddWordEntry = () => {
    const word = wordInput.trim().toLowerCase()
    if (!word) return
    if (!wordEntries.includes(word)) {
      setWordEntries(entries => [...entries, word])
    }
    setWordInput('')
  }

  const handleRemoveWordEntry = (word) => {
    setWordEntries(entries => entries.filter(w => w !== word))
  }

  const handleSubmitWords = () => {
    if (wordSubmitted) return
    setWordSubmitted(true)
    if (wordTimerRef.current) { clearInterval(wordTimerRef.current); wordTimerRef.current = null }

    socket.emit('player:submit_words', {
      gameId: gameIdRef.current,
      words: wordEntries
    })
  }

  // Auto-submit when the word timer runs out
  useEffect(() => {
    if (gameState === 'word_play' && wordTimeLeft === 0 && !wordSubmitted) {
      handleSubmitWords()
    }
  }, [wordTimeLeft, gameState, wordSubmitted])

  const handleAddBingoNumber = () => {
    const num = parseInt(bingoPickInput)
    if (isNaN(num) || num < 1 || num > 90) return
    if (bingoNumbers.includes(num)) return
    if (bingoNumbers.length >= 9) return
    setBingoNumbers(nums => [...nums, num].sort((a, b) => a - b))
    setBingoPickInput('')
  }

  const handleRemoveBingoNumber = (num) => {
    setBingoNumbers(nums => nums.filter(n => n !== num))
  }

  const handleSubmitBingoNumbers = () => {
    if (bingoSubmitted) return
    setBingoSubmitted(true)
    if (bingoPickTimerRef.current) { clearInterval(bingoPickTimerRef.current); bingoPickTimerRef.current = null }

    socket.emit('player:submit_bingo_numbers', {
      gameId: gameIdRef.current,
      numbers: bingoNumbers
    })
  }

  // Auto-submit bingo numbers when the pick timer runs out
  useEffect(() => {
    if (gameState === 'bingo_pick' && bingoPickTime === 0 && !bingoSubmitted) {
      handleSubmitBingoNumbers()
    }
  }, [bingoPickTime, gameState, bingoSubmitted])

  const handleClaimBingo = (type) => {
    socket.emit('player:claim_bingo', { gameId: gameIdRef.current, type })
  }

  const toggleBingoMark = (n) => {
    setBingoMarked(marked => marked.includes(n) ? marked.filter(m => m !== n) : [...marked, n])
  }

  const handleWordleKey = (key) => {
    if (wordleFinished) return
    if (key === 'ENTER') {
      if (wordleCurrent.length !== wordleRoundInfo.wordLength) {
        setWordleError(`Guess must be ${wordleRoundInfo.wordLength} letters.`)
        if (wordleErrorTimerRef.current) clearTimeout(wordleErrorTimerRef.current)
        wordleErrorTimerRef.current = setTimeout(() => setWordleError(''), 2000)
        return
      }
      wordlePendingGuessRef.current = wordleCurrent
      socket.emit('player:submit_guess', { gameId: gameIdRef.current, guess: wordleCurrent })
      return
    }
    if (key === 'BACKSPACE') {
      setWordleCurrent(c => c.slice(0, -1))
      return
    }
    if (/^[a-zA-Z]$/.test(key)) {
      setWordleCurrent(c => (c.length < wordleRoundInfo.wordLength ? c + key.toLowerCase() : c))
    }
  }

  // Physical keyboard support while guessing
  useEffect(() => {
    if (gameState !== 'wordle_play' || wordleFinished) return
    const onKeyDown = (e) => {
      if (e.key === 'Enter') handleWordleKey('ENTER')
      else if (e.key === 'Backspace') handleWordleKey('BACKSPACE')
      else if (/^[a-zA-Z]$/.test(e.key)) handleWordleKey(e.key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [gameState, wordleFinished, wordleCurrent, wordleRoundInfo.wordLength])

  // Auto-forfeit when the wordle timer runs out without finishing
  useEffect(() => {
    if (gameState === 'wordle_play' && wordleTimeLeft === 0 && !wordleFinished) {
      setWordleFinished(true)
    }
  }, [wordleTimeLeft, gameState, wordleFinished])

  const wordleLetterStates = {}
  for (const { guess, feedback } of wordleGuesses) {
    for (let i = 0; i < guess.length; i++) {
      const ch = guess[i]
      const f = feedback[i]
      const rank = { absent: 0, present: 1, correct: 2 }
      if (!wordleLetterStates[ch] || rank[f] > rank[wordleLetterStates[ch]]) {
        wordleLetterStates[ch] = f
      }
    }
  }

  const WORDLE_KEY_ROWS = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['ENTER', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'BACKSPACE']
  ]

  if (gameState === 'waiting') {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
          <h2>Waiting for game to start...</h2>
          <p className="text-muted mt-2">
            Welcome, <strong>{nicknameRef.current}</strong>!
          </p>
          <p className="text-muted mt-1">The host will start the game shortly.</p>
        </div>
      </div>
    )
  }

  if (gameState === 'question' || gameState === 'answered') {
    const options = question?.options || {}
    const optionKeys = Object.keys(options)

    return (
      <div className="page" style={{ gap: '0' }}>
        {question && (
          <>
            <div className="question-meta" style={{ maxWidth: '600px' }}>
              <span>Question {question.questionNumber} of {question.totalQuestions}</span>
              <span>⏱ {question.timeLimit}s</span>
            </div>

            <div className="question-box" style={{ maxWidth: '600px' }}>
              {question.text}
            </div>

            <div className={`answer-grid ${optionKeys.length === 2 ? 'two-col' : ''}`} style={{ maxWidth: '600px' }}>
              {optionKeys.map(key => (
                <button
                  key={key}
                  className={`answer-btn ${OPTION_COLORS[key] || 'btn-a'} ${selectedAnswer === key ? 'selected' : ''}`}
                  onClick={() => handleAnswer(key)}
                  disabled={gameState === 'answered'}
                >
                  <span style={{ marginRight: '0.5rem' }}>{OPTION_EMOJIS[key]}</span>
                  {options[key]}
                </button>
              ))}
            </div>

            {gameState === 'answered' && (
              <p className="waiting-msg mt-3">✅ Answer submitted! Waiting for others...</p>
            )}
          </>
        )}
      </div>
    )
  }

  if (gameState === 'draw_drawing') {
    return (
      <div className="page" style={{ gap: '0' }}>
        <div className="question-meta" style={{ maxWidth: '500px' }}>
          <span>Round {drawRoundInfo.roundNumber} of {drawRoundInfo.totalRounds}</span>
          <span>⏱ {drawTimeLeft}s</span>
        </div>

        <div className="question-box" style={{ maxWidth: '500px' }}>
          🎨 Draw: <strong>{drawWord}</strong>
        </div>

        <DrawCanvas ref={canvasRef} />

        {drawSubmitted ? (
          <p className="waiting-msg mt-3">✅ Drawing submitted! Waiting for others...</p>
        ) : (
          <div className="btn-group" style={{ maxWidth: '500px', width: '100%' }}>
            <button className="btn btn-secondary" onClick={() => canvasRef.current?.clear()}>
              🗑 Clear
            </button>
            <button className="btn btn-primary" onClick={handleSubmitDrawing}>
              ✅ Submit
            </button>
          </div>
        )}
      </div>
    )
  }

  if (gameState === 'draw_voting') {
    return (
      <div className="page">
        <div className="question-box" style={{ maxWidth: '600px' }}>
          🗳 Vote for your favourite "{drawWord}"
        </div>

        {votedFor ? (
          <p className="waiting-msg mt-3">✅ Vote submitted! Waiting for others...</p>
        ) : voteDrawings.length === 0 ? (
          <p className="waiting-msg mt-3">No other drawings to vote on this round.</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '1rem',
              width: '100%',
              maxWidth: '600px',
              marginTop: '1rem'
            }}
          >
            {voteDrawings.map(d => (
              <img
                key={d.socketId}
                src={d.image}
                alt="Drawing to vote on"
                onClick={() => handleVote(d.socketId)}
                style={{
                  width: '100%',
                  borderRadius: '12px',
                  border: '2px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  transition: 'transform 0.1s ease'
                }}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (gameState === 'draw_reveal') {
    return (
      <div className="page">
        <div className="question-box" style={{ maxWidth: '700px' }}>
          🏆 Results for "{drawWord}"
        </div>

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
          {drawResults.map((r, i) => (
            <div key={r.socketId} style={{ textAlign: 'center' }}>
              <img
                src={r.image}
                alt="Drawing result"
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

        <div className="card mt-3" style={{ maxWidth: '480px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Your score</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#fbbf24' }}>{myScore} pts</div>
        </div>

        <p className="waiting-msg">Waiting for host to continue...</p>
      </div>
    )
  }

  if (gameState === 'word_play') {
    return (
      <div className="page" style={{ gap: '0' }}>
        <div className="question-meta" style={{ maxWidth: '500px' }}>
          <span>📝 Word Splash</span>
          <span>⏱ {wordTimeLeft}s</span>
        </div>

        <div className="question-box" style={{ maxWidth: '500px', fontSize: '1.8rem', letterSpacing: '0.2rem' }}>
          {wordBase}
        </div>

        {wordSubmitted ? (
          <p className="waiting-msg mt-3">✅ Submitted! Waiting for others...</p>
        ) : (
          <>
            <div className="btn-group" style={{ maxWidth: '500px', width: '100%' }}>
              <input
                type="text"
                value={wordInput}
                onChange={e => setWordInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddWordEntry() }}
                placeholder="Type a word..."
                style={{ flex: 1 }}
                autoFocus
              />
              <button className="btn btn-secondary" onClick={handleAddWordEntry}>
                ➕ Add
              </button>
            </div>

            {wordEntries.length > 0 && (
              <ul className="scores-list" style={{ maxWidth: '500px', width: '100%', margin: '1rem auto 0' }}>
                {wordEntries.map(word => (
                  <li key={word} className="score-item">
                    <span className="name">{word}</span>
                    <button className="btn btn-danger btn-sm" style={{ width: 'auto', padding: '0.25rem 0.75rem' }} onClick={() => handleRemoveWordEntry(word)}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button className="btn btn-primary mt-3" style={{ maxWidth: '500px', width: '100%' }} onClick={handleSubmitWords}>
              ✅ Submit
            </button>
          </>
        )}
      </div>
    )
  }

  if (gameState === 'word_reveal') {
    return (
      <div className="page">
        <div className="question-box" style={{ maxWidth: '600px' }}>
          🏆 Results — base word: <strong>{wordBase}</strong>
        </div>

        {wordScore && (
          <div className="card mt-3" style={{ maxWidth: '480px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Your words</div>
            <div style={{ fontSize: '1rem' }}>
              {wordScore.words.length > 0 ? wordScore.words.join(', ') : 'None found'}
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#fbbf24', marginTop: '0.5rem' }}>
              +{wordScore.score} pts
            </div>
          </div>
        )}

        <ul className="scores-list mt-3" style={{ maxWidth: '500px', margin: '1rem auto 0' }}>
          {wordResults.map((player, i) => (
            <li
              key={player.nickname}
              className="score-item"
              style={{
                background: player.nickname === nicknameRef.current
                  ? 'rgba(233, 69, 96, 0.25)'
                  : undefined
              }}
            >
              <span className="rank">{i + 1}.</span>
              <span className="name">{player.nickname}</span>
              <span className="points">{player.totalScore} pts</span>
            </li>
          ))}
        </ul>

        <p className="waiting-msg">Waiting for host to continue...</p>
      </div>
    )
  }

  if (gameState === 'bingo_pick') {
    return (
      <div className="page" style={{ gap: '0' }}>
        <div className="question-meta" style={{ maxWidth: '500px' }}>
          <span>🎱 Pick 9 numbers (1-90)</span>
          <span>⏱ {bingoPickTime}s</span>
        </div>

        {bingoSubmitted ? (
          <p className="waiting-msg mt-3">✅ Numbers locked in! Waiting for others...</p>
        ) : (
          <>
            <div className="btn-group" style={{ maxWidth: '500px', width: '100%' }}>
              <input
                type="number"
                min="1"
                max="90"
                value={bingoPickInput}
                onChange={e => setBingoPickInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddBingoNumber() }}
                placeholder="Enter a number 1-90"
                style={{ flex: 1 }}
                autoFocus
              />
              <button className="btn btn-secondary" onClick={handleAddBingoNumber} disabled={bingoNumbers.length >= 9}>
                ➕ Add
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', maxWidth: '500px', marginTop: '1rem' }}>
              {bingoNumbers.map(n => (
                <div
                  key={n}
                  onClick={() => handleRemoveBingoNumber(n)}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: '#7C3AED',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                  title="Tap to remove"
                >
                  {n}
                </div>
              ))}
            </div>

            <p className="text-muted mt-2" style={{ textAlign: 'center' }}>{bingoNumbers.length} / 9 chosen</p>

            <button
              className="btn btn-primary mt-3"
              style={{ maxWidth: '500px', width: '100%' }}
              onClick={handleSubmitBingoNumbers}
              disabled={bingoNumbers.length !== 9}
            >
              ✅ Submit
            </button>
          </>
        )}
      </div>
    )
  }

  if (gameState === 'bingo_play') {
    return (
      <div className="page" style={{ gap: '0' }}>
        <div className="question-meta" style={{ maxWidth: '500px' }}>
          <span>🎱 Bingo!</span>
          <span>{bingoCalled.length} called</span>
        </div>

        {bingoLatest !== null && (
          <div style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            background: '#7C3AED',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.2rem',
            fontWeight: '800',
            color: 'white',
            margin: '0.5rem auto',
            boxShadow: '0 4px 20px rgba(124,58,237,0.5)'
          }}>
            {bingoLatest}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.5rem',
            width: '100%',
            maxWidth: '320px',
            margin: '1rem auto'
          }}
        >
          {bingoNumbers.map(n => {
            const marked = bingoMarked.includes(n)
            return (
              <div
                key={n}
                onClick={() => toggleBingoMark(n)}
                style={{
                  aspectRatio: '1',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: marked ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.06)',
                  border: marked ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.15)',
                  color: marked ? '#86efac' : 'white'
                }}
              >
                {n}
              </div>
            )
          })}
        </div>

        {bingoWinners.length > 0 && (
          <div style={{ maxWidth: '500px', width: '100%', margin: '0 auto 1rem' }}>
            {bingoWinners.map((w, i) => (
              <p key={i} className="text-muted" style={{ textAlign: 'center', margin: '0.25rem 0' }}>
                {w.type === 'line' ? '➖ Line' : '🏠 Full House'}: <strong>{w.nickname}</strong>
              </p>
            ))}
          </div>
        )}

        <div className="btn-group" style={{ maxWidth: '500px', width: '100%' }}>
          <button
            className="btn btn-secondary"
            onClick={() => handleClaimBingo('line')}
            disabled={bingoLineClaimed || bingoWinners.some(w => w.type === 'line')}
          >
            ➖ Line!
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleClaimBingo('fullhouse')}
            disabled={bingoFullHouseClaimed || bingoWinners.some(w => w.type === 'fullhouse')}
          >
            🏠 House!
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'bingo_reveal') {
    return (
      <div className="page">
        <div className="question-box" style={{ maxWidth: '600px' }}>
          🏆 Bingo Results
        </div>

        <div className="card mt-3" style={{ maxWidth: '480px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Your score</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#fbbf24' }}>{myScore} pts</div>
        </div>

        <ul className="scores-list mt-3" style={{ maxWidth: '500px', margin: '1rem auto 0' }}>
          {bingoScores.map((player, i) => (
            <li
              key={player.nickname}
              className="score-item"
              style={{
                background: player.nickname === nicknameRef.current
                  ? 'rgba(233, 69, 96, 0.25)'
                  : undefined
              }}
            >
              <span className="rank">{i + 1}.</span>
              <span className="name">{player.nickname}</span>
              <span className="points">{player.score} pts</span>
            </li>
          ))}
        </ul>

        <p className="waiting-msg">Waiting for host to continue...</p>
      </div>
    )
  }

  if (gameState === 'wordle_play') {
    const maxGuesses = wordleRoundInfo.maxGuesses
    const wordLength = wordleRoundInfo.wordLength
    const rowsToShow = [...wordleGuesses]
    if (!wordleFinished && rowsToShow.length < maxGuesses) rowsToShow.push({ guess: wordleCurrent, feedback: null })
    while (rowsToShow.length < maxGuesses) rowsToShow.push({ guess: '', feedback: null })

    return (
      <div className="page" style={{ gap: '0' }}>
        <div className="question-meta" style={{ maxWidth: '500px' }}>
          <span>🟩 Round {wordleRoundInfo.roundNumber} of {wordleRoundInfo.totalRounds}</span>
          <span>⏱ {wordleTimeLeft}s</span>
        </div>

        <div className="wordle-grid">
          {rowsToShow.map((row, ri) => (
            <div className="wordle-row" key={ri}>
              {Array.from({ length: wordLength }).map((_, ci) => {
                const letter = row.guess[ci] || ''
                const f = row.feedback ? row.feedback[ci] : null
                return (
                  <div key={ci} className={`wordle-tile ${f || (letter ? 'filled' : '')}`}>
                    {letter}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {wordleError && (
          <p className="text-center" style={{ color: '#ef4444', fontWeight: '700', margin: '0.5rem 0' }}>
            {wordleError}
          </p>
        )}

        {wordleFinished ? (
          <p className="waiting-msg mt-3">
            {wordleSolved ? '✅ Solved!' : '❌ Out of guesses!'} Waiting for others...
          </p>
        ) : (
          <div className="wordle-keyboard">
            {WORDLE_KEY_ROWS.map((row, ri) => (
              <div className="wordle-keyboard-row" key={ri}>
                {row.map(key => (
                  <button
                    key={key}
                    className={`wordle-key ${key.length > 1 ? 'wide' : (wordleLetterStates[key] || '')}`}
                    onClick={() => handleWordleKey(key)}
                  >
                    {key === 'BACKSPACE' ? '⌫' : key === 'ENTER' ? 'Enter' : key}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (gameState === 'wordle_reveal') {
    const me = wordleResults.find(p => p.nickname === nicknameRef.current)

    return (
      <div className="page">
        <div className="question-box" style={{ maxWidth: '600px' }}>
          🏆 The word was: <strong style={{ letterSpacing: '0.2rem' }}>{wordleSecretWord.toUpperCase()}</strong>
        </div>

        {me && (
          <div className="card mt-3" style={{ maxWidth: '480px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              {me.solved ? `Solved in ${me.guessCount}` : 'Not solved'}
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#fbbf24' }}>{myScore} pts</div>
          </div>
        )}

        <ul className="scores-list mt-3" style={{ maxWidth: '500px', margin: '1rem auto 0' }}>
          {wordleResults.map((player, i) => (
            <li
              key={player.nickname}
              className="score-item"
              style={{
                background: player.nickname === nicknameRef.current
                  ? 'rgba(233, 69, 96, 0.25)'
                  : undefined
              }}
            >
              <span className="rank">{i + 1}.</span>
              <span className="name">{player.nickname}</span>
              <span className="points">{player.totalScore} pts</span>
            </li>
          ))}
        </ul>

        <p className="waiting-msg">Waiting for host to continue...</p>
      </div>
    )
  }

  if (gameState === 'reveal') {
    const options = question?.options || {}
    const optionKeys = Object.keys(options)
    const gotItRight = selectedAnswer === correctAnswer

    return (
      <div className="page">
        <div className="question-box" style={{ maxWidth: '600px', marginBottom: '1rem' }}>
          {question?.text}
        </div>

        <div className={`result-flash ${gotItRight ? 'correct' : 'incorrect'}`}>
          {gotItRight ? '✅ Correct!' : '❌ Wrong!'}
        </div>

        <div className={`answer-grid ${optionKeys.length === 2 ? 'two-col' : ''}`} style={{ maxWidth: '600px' }}>
          {optionKeys.map(key => (
            <button
              key={key}
              className={`answer-btn ${OPTION_COLORS[key] || 'btn-a'} ${
                key === correctAnswer ? 'correct' : selectedAnswer === key ? 'incorrect' : ''
              }`}
              disabled
            >
              <span style={{ marginRight: '0.5rem' }}>{OPTION_EMOJIS[key]}</span>
              {options[key]}
              {key === correctAnswer && ' ✓'}
            </button>
          ))}
        </div>

        <div className="card mt-3" style={{ maxWidth: '480px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Your score</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#fbbf24' }}>{myScore} pts</div>
          {myPosition && (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              You are #{myPosition} of {scores.length}
            </div>
          )}
        </div>

        <p className="waiting-msg">Waiting for host to continue...</p>
      </div>
    )
  }

  if (gameState === 'end') {
    const position = myPosition || finalScores.findIndex(p => p.nickname === nicknameRef.current) + 1
    const posEmoji = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '🎉'

    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>{posEmoji}</div>
          <h2>Game Over!</h2>
          <div style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>
            You finished <strong>#{position}</strong>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#fbbf24', marginTop: '0.25rem' }}>
            {myScore} pts
          </div>

          <hr className="divider" />

          <h3>Final Standings</h3>
          <ul className="scores-list" style={{ margin: '0 auto' }}>
            {finalScores.map((player, i) => (
              <li
                key={player.nickname}
                className="score-item"
                style={{
                  background: player.nickname === nicknameRef.current
                    ? 'rgba(233, 69, 96, 0.25)'
                    : undefined
                }}
              >
                <span className="rank">{i + 1}.</span>
                <span className="name">{player.nickname}</span>
                <span className="points">{player.score} pts</span>
              </li>
            ))}
          </ul>

          <button className="btn btn-primary mt-4" onClick={handlePlayAgain}>
            🔄 Play Again
          </button>

          <video
            src="/outro.mp4"
            autoPlay
            loop
            muted
            playsInline
            style={{ width: '100%', borderRadius: '12px', marginTop: '1.5rem' }}
          />
        </div>
      </div>
    )
  }

  return null
}

export default PlayerGame
