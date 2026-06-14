const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const db = require('./db');
const gameManager = require('./game/gameManager');
const adminRouter = require('./routes/admin');
const leaderboardRouter = require('./routes/leaderboard');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/admin', adminRouter);
app.use('/api/leaderboard', leaderboardRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Topics available for Draw game mode
app.get('/api/draw-topics', (req, res) => {
  const categories = db.getDrawCategories();
  const topics = categories.map(c => c.name);
  if (topics.length > 1) topics.push('Random');
  res.json(topics);
});

// Serve the built client (production)
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Generate a random 4-digit PIN
function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Socket.io events
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // HOST: Create a new game
  socket.on('host:create', ({ categoryId, questionCount }) => {
    try {
      const pin = generatePin();
      const questions = db.getQuestions(categoryId);

      if (!questions || questions.length === 0) {
        socket.emit('error', { message: 'No questions found for this category.' });
        return;
      }

      // Shuffle questions
      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      const count = questionCount && questionCount !== 'all'
        ? Math.min(parseInt(questionCount), shuffled.length)
        : shuffled.length;

      const gameId = gameManager.createGame(pin, categoryId, shuffled, socket.id, count);
      db.createGameSession(pin, categoryId);

      socket.join(pin);
      socket.emit('host:created', { pin, gameId, mode: 'quiz' });
      console.log(`Game created: PIN=${pin}, gameId=${gameId}, questions=${count}`);
    } catch (err) {
      console.error('host:create error:', err);
      socket.emit('error', { message: err.message });
    }
  });

  // HOST: Create a new Draw game
  socket.on('host:create_draw', ({ topic, rounds }) => {
    try {
      const pin = generatePin();
      const categories = db.getDrawCategories();
      const topics = categories.map(c => c.name).concat(categories.length > 1 ? ['Random'] : []);
      const chosenTopic = topics.includes(topic) ? topic : topics[0];

      if (!chosenTopic) {
        socket.emit('error', { message: 'No draw categories found. Add some in Admin first.' });
        return;
      }

      const words = db.getDrawWordsForTopic(chosenTopic);
      if (!words || words.length === 0) {
        socket.emit('error', { message: 'No words found for this topic.' });
        return;
      }

      const roundCount = Math.min(Math.max(parseInt(rounds) || 5, 1), 20);

      const gameId = gameManager.createDrawGame(pin, chosenTopic, words, socket.id, roundCount);
      db.createGameSession(pin, null);

      socket.join(pin);
      socket.emit('host:created', { pin, gameId, mode: 'draw' });
      console.log(`Draw game created: PIN=${pin}, gameId=${gameId}, topic=${chosenTopic}, rounds=${roundCount}`);
    } catch (err) {
      console.error('host:create_draw error:', err);
      socket.emit('error', { message: err.message });
    }
  });

  // HOST: Create a new Word Splash game
  socket.on('host:create_word', ({ timeLimit }) => {
    try {
      const pin = generatePin();
      const limit = Math.min(Math.max(parseInt(timeLimit) || 120, 30), 300);

      const gameId = gameManager.createWordGame(pin, socket.id, limit);
      db.createGameSession(pin, null);

      socket.join(pin);
      socket.emit('host:created', { pin, gameId, mode: 'word' });
      console.log(`Word game created: PIN=${pin}, gameId=${gameId}, timeLimit=${limit}`);
    } catch (err) {
      console.error('host:create_word error:', err);
      socket.emit('error', { message: err.message });
    }
  });

  // HOST: Create a new Bingo game
  socket.on('host:create_bingo', () => {
    try {
      const pin = generatePin();

      const gameId = gameManager.createBingoGame(pin, socket.id);
      db.createGameSession(pin, null);

      socket.join(pin);
      socket.emit('host:created', { pin, gameId, mode: 'bingo' });
      console.log(`Bingo game created: PIN=${pin}, gameId=${gameId}`);
    } catch (err) {
      console.error('host:create_bingo error:', err);
      socket.emit('error', { message: err.message });
    }
  });

  // PLAYER: Join a game
  socket.on('player:join', ({ pin, nickname }) => {
    try {
      const game = gameManager.getGameByPin(pin);

      if (!game) {
        socket.emit('player:join_error', { message: 'Game not found. Check your PIN.' });
        return;
      }

      if (game.status !== 'lobby') {
        socket.emit('player:join_error', { message: 'This game has already started.' });
        return;
      }

      // Check if nickname already in use in this game
      for (const player of game.players.values()) {
        if (player.nickname.toLowerCase() === nickname.toLowerCase()) {
          socket.emit('player:join_error', { message: 'That nickname is already taken in this game.' });
          return;
        }
      }

      const nicknameRecord = db.getOrCreateNickname(nickname);
      gameManager.addPlayer(game.gameId, socket.id, nickname, nicknameRecord.id);

      socket.join(pin);
      socket.emit('player:joined', { success: true, gameId: game.gameId, nickname });

      // Broadcast updated player list to the whole room (including host)
      const players = [];
      for (const player of game.players.values()) {
        players.push(player.nickname);
      }
      io.to(pin).emit('lobby:player_joined', { players });

      console.log(`Player joined: ${nickname} -> game ${pin}`);
    } catch (err) {
      console.error('player:join error:', err);
      socket.emit('player:join_error', { message: err.message });
    }
  });

  // HOST: Start the game
  socket.on('host:start_game', ({ gameId }) => {
    try {
      const game = gameManager.getGame(gameId);
      if (!game) {
        socket.emit('error', { message: 'Game not found.' });
        return;
      }

      if (game.hostSocketId !== socket.id) {
        socket.emit('error', { message: 'Only the host can start the game.' });
        return;
      }

      game.status = 'active';
      db.updateGameSessionStatus(game.pin, 'active');

      if (game.mode === 'draw') {
        const word = gameManager.pickWord(gameId);
        io.to(game.pin).emit('game:draw_round', {
          word,
          roundNumber: game.currentRound,
          totalRounds: game.rounds,
          timeLimit: 60
        });
        console.log(`Draw game started: ${gameId}, round 1 word=${word}`);
        return;
      }

      if (game.mode === 'word') {
        io.to(game.pin).emit('game:word_round', {
          baseWord: game.baseWord,
          timeLimit: game.timeLimit
        });
        game.wordTimeout = setTimeout(() => showWordResults(game), game.timeLimit * 1000);
        console.log(`Word game started: ${gameId}, baseWord=${game.baseWord}, timeLimit=${game.timeLimit}`);
        return;
      }

      if (game.mode === 'bingo') {
        const pickTime = 30;
        io.to(game.pin).emit('game:bingo_pick', { pickTime });
        game.bingoPickTimeout = setTimeout(() => startBingoCalling(game), pickTime * 1000);
        console.log(`Bingo game started: ${gameId}, picking phase`);
        return;
      }

      const question = gameManager.nextQuestion(gameId);
      if (!question) {
        socket.emit('error', { message: 'No questions available.' });
        return;
      }

      emitQuestion(game.pin, question, game.currentQuestionIndex, game.questions.length);
      console.log(`Game started: ${gameId}`);
    } catch (err) {
      console.error('host:start_game error:', err);
      socket.emit('error', { message: err.message });
    }
  });

  // PLAYER: Submit an answer
  socket.on('player:answer', ({ gameId, questionId, answer }) => {
    try {
      const game = gameManager.getGame(gameId);
      if (!game || game.status !== 'active') return;

      const player = game.players.get(socket.id);
      if (!player) return;

      // Don't allow re-answering
      if (player.answered) return;

      gameManager.recordAnswer(gameId, questionId, socket.id, answer);

      // Check if correct
      const question = game.questions.find(q => q.id === questionId);
      if (question && question.correct_answer === answer) {
        player.score += 100;
      }

      // Count how many have answered
      const answeredCount = game.answers.has(questionId)
        ? game.answers.get(questionId).size
        : 0;
      const totalPlayers = game.players.size;

      // Notify host only
      io.to(game.hostSocketId).emit('game:answer_received', {
        answeredCount,
        totalPlayers
      });


      console.log(`Answer recorded: player=${player.nickname}, answer=${answer}, correct=${question?.correct_answer}`);
    } catch (err) {
      console.error('player:answer error:', err);
    }
  });

  // HOST: Show the correct answer and scores
  socket.on('host:show_answer', ({ gameId }) => {
    try {
      const game = gameManager.getGame(gameId);
      if (!game) return;

      if (game.hostSocketId !== socket.id) return;

      // Cancel any auto-advance in progress
      if (game.revealTimeout) { clearTimeout(game.revealTimeout); game.revealTimeout = null; }
      if (game.nextTimeout) { clearTimeout(game.nextTimeout); game.nextTimeout = null; }

      const question = gameManager.getCurrentQuestion(gameId);
      if (!question) return;

      const scores = gameManager.calculateScores(gameId);

      io.to(game.pin).emit('game:reveal', {
        correctAnswer: question.correct_answer,
        questionId: question.id,
        scores: scores.map(s => ({ nickname: s.nickname, score: s.score }))
      });

      console.log(`Answer revealed for game ${gameId}`);
    } catch (err) {
      console.error('host:show_answer error:', err);
    }
  });

  // HOST: Advance to next question
  socket.on('host:next_question', ({ gameId }) => {
    try {
      const game = gameManager.getGame(gameId);
      if (!game) return;

      if (game.hostSocketId !== socket.id) return;

      // Cancel any pending auto-advance
      if (game.nextTimeout) { clearTimeout(game.nextTimeout); game.nextTimeout = null; }

      const question = gameManager.nextQuestion(gameId);

      if (!question) {
        // No more questions — end the game automatically
        endGameLogic(gameId, socket);
        return;
      }

      emitQuestion(game.pin, question, game.currentQuestionIndex, game.questions.length);
      console.log(`Next question for game ${gameId}: index ${game.currentQuestionIndex}`);
    } catch (err) {
      console.error('host:next_question error:', err);
    }
  });

  // PLAYER: Submit a drawing
  socket.on('player:submit_drawing', ({ gameId, drawing }) => {
    try {
      const game = gameManager.getGame(gameId);
      if (!game || game.status !== 'active' || game.mode !== 'draw') return;

      const player = game.players.get(socket.id);
      if (!player || player.answered) return;

      gameManager.submitDrawing(gameId, socket.id, drawing);

      const submittedCount = game.drawings.size;
      const totalPlayers = game.players.size;

      io.to(game.hostSocketId).emit('game:drawing_received', { submittedCount, totalPlayers });

      if (submittedCount > 0 && submittedCount === totalPlayers) {
        startVoting(game);
      }

      console.log(`Drawing submitted: player=${player.nickname}, game=${gameId}`);
    } catch (err) {
      console.error('player:submit_drawing error:', err);
    }
  });

  // HOST: Force-start voting (e.g. if not everyone submitted in time)
  socket.on('host:start_voting', ({ gameId }) => {
    try {
      const game = gameManager.getGame(gameId);
      if (!game || game.mode !== 'draw') return;
      if (game.hostSocketId !== socket.id) return;

      startVoting(game);
    } catch (err) {
      console.error('host:start_voting error:', err);
    }
  });

  // PLAYER: Vote for a favourite drawing
  socket.on('player:vote', ({ gameId, votedFor }) => {
    try {
      const game = gameManager.getGame(gameId);
      if (!game || game.mode !== 'draw') return;

      const ok = gameManager.recordVote(gameId, socket.id, votedFor);
      if (!ok) return;

      const votedCount = game.votes.size;
      const totalPlayers = game.players.size;

      io.to(game.hostSocketId).emit('game:vote_received', { votedCount, totalPlayers });

      if (votedCount === totalPlayers) {
        showDrawResults(game);
      }
    } catch (err) {
      console.error('player:vote error:', err);
    }
  });

  // HOST: Force-show draw results (e.g. if not everyone voted in time)
  socket.on('host:show_draw_results', ({ gameId }) => {
    try {
      const game = gameManager.getGame(gameId);
      if (!game || game.mode !== 'draw') return;
      if (game.hostSocketId !== socket.id) return;

      showDrawResults(game);
    } catch (err) {
      console.error('host:show_draw_results error:', err);
    }
  });

  // HOST: Move to the next drawing round (or end the game)
  socket.on('host:next_round', ({ gameId }) => {
    try {
      const game = gameManager.getGame(gameId);
      if (!game || game.mode !== 'draw') return;
      if (game.hostSocketId !== socket.id) return;

      if (game.currentRound >= game.rounds) {
        endGameLogic(gameId, socket);
        return;
      }

      const word = gameManager.pickWord(gameId);
      io.to(game.pin).emit('game:draw_round', {
        word,
        roundNumber: game.currentRound,
        totalRounds: game.rounds,
        timeLimit: 60
      });
      console.log(`Next draw round for game ${gameId}: round ${game.currentRound}, word=${word}`);
    } catch (err) {
      console.error('host:next_round error:', err);
    }
  });

  // PLAYER: Submit words found in the base word
  socket.on('player:submit_words', ({ gameId, words }) => {
    try {
      const game = gameManager.getGame(gameId);
      if (!game || game.status !== 'active' || game.mode !== 'word') return;

      const player = game.players.get(socket.id);
      if (!player || player.answered) return;

      const result = gameManager.submitWords(gameId, socket.id, words);
      socket.emit('player:word_score', result);

      const submittedCount = Array.from(game.players.values()).filter(p => p.answered).length;
      const totalPlayers = game.players.size;

      io.to(game.hostSocketId).emit('game:words_received', { submittedCount, totalPlayers });

      if (submittedCount > 0 && submittedCount === totalPlayers) {
        showWordResults(game);
      }

      console.log(`Words submitted: player=${player.nickname}, score=${result.score}, game=${gameId}`);
    } catch (err) {
      console.error('player:submit_words error:', err);
    }
  });

  // HOST: Force-show word results (e.g. if not everyone submitted in time)
  socket.on('host:show_word_results', ({ gameId }) => {
    try {
      const game = gameManager.getGame(gameId);
      if (!game || game.mode !== 'word') return;
      if (game.hostSocketId !== socket.id) return;

      showWordResults(game);
    } catch (err) {
      console.error('host:show_word_results error:', err);
    }
  });

  // PLAYER: Submit chosen bingo numbers
  socket.on('player:submit_bingo_numbers', ({ gameId, numbers }) => {
    try {
      const game = gameManager.getGame(gameId);
      if (!game || game.mode !== 'bingo') return;

      const player = game.players.get(socket.id);
      if (!player || player.answered) return;

      const nums = gameManager.submitBingoNumbers(gameId, socket.id, numbers);
      socket.emit('player:bingo_numbers_confirmed', { numbers: nums });

      const submittedCount = Array.from(game.players.values()).filter(p => p.answered).length;
      const totalPlayers = game.players.size;

      io.to(game.hostSocketId).emit('game:bingo_picks_received', { submittedCount, totalPlayers });

      if (submittedCount > 0 && submittedCount === totalPlayers) {
        if (game.bingoPickTimeout) { clearTimeout(game.bingoPickTimeout); game.bingoPickTimeout = null; }
        startBingoCalling(game);
      }

      console.log(`Bingo numbers submitted: player=${player.nickname}, game=${gameId}`);
    } catch (err) {
      console.error('player:submit_bingo_numbers error:', err);
    }
  });

  // PLAYER: Claim a line or full house
  socket.on('player:claim_bingo', ({ gameId, type }) => {
    try {
      const game = gameManager.getGame(gameId);
      if (!game || game.mode !== 'bingo') return;

      const player = game.players.get(socket.id);
      if (!player) return;

      const result = gameManager.claimBingo(gameId, socket.id, type);
      socket.emit('player:bingo_claim_result', { type, ...result });

      if (result.success) {
        io.to(game.pin).emit('game:bingo_win', { type, nickname: result.nickname, points: result.points });
        console.log(`Bingo ${type} claimed by ${result.nickname} in game ${gameId}`);

        if (type === 'fullhouse') {
          showBingoResults(game);
        }
      } else if (result.reason === 'invalid') {
        io.to(game.pin).emit('game:bingo_cheat', { type, nickname: player.nickname });
        console.log(`Bingo false claim (${type}) by ${player.nickname} in game ${gameId}`);
      }
    } catch (err) {
      console.error('player:claim_bingo error:', err);
    }
  });

  // HOST: Force-show bingo results (e.g. end the calling phase early)
  socket.on('host:show_bingo_results', ({ gameId }) => {
    try {
      const game = gameManager.getGame(gameId);
      if (!game || game.mode !== 'bingo') return;
      if (game.hostSocketId !== socket.id) return;

      showBingoResults(game);
    } catch (err) {
      console.error('host:show_bingo_results error:', err);
    }
  });

  // HOST: Manually end the game
  socket.on('host:end_game', ({ gameId }) => {
    try {
      const game = gameManager.getGame(gameId);
      if (!game) return;

      if (game.hostSocketId !== socket.id) return;

      endGameLogic(gameId, socket);
    } catch (err) {
      console.error('host:end_game error:', err);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    handleDisconnect(socket.id);
  });
});

function emitQuestion(pin, question, index, total) {
  const options = {};
  if (question.option_a) options.A = question.option_a;
  if (question.option_b) options.B = question.option_b;
  if (question.option_c) options.C = question.option_c;
  if (question.option_d) options.D = question.option_d;

  io.to(pin).emit('game:question', {
    questionId: question.id,
    text: question.question_text,
    type: question.type,
    options,
    timeLimit: 20,
    questionNumber: index + 1,
    totalQuestions: total
  });
}

function startVoting(game) {
  if (game.votingStarted) return;
  game.votingStarted = true;

  const drawingsArr = Array.from(game.drawings.entries()).map(([socketId, image]) => ({ socketId, image }));

  // Not enough drawings to vote on — skip straight to results
  if (drawingsArr.length < 2) {
    showDrawResults(game);
    return;
  }

  for (const socketId of game.players.keys()) {
    const options = drawingsArr.filter(d => d.socketId !== socketId);
    io.to(socketId).emit('game:vote_phase', { drawings: options, totalPlayers: game.players.size });
  }

  io.to(game.hostSocketId).emit('game:vote_phase', { drawings: drawingsArr, totalPlayers: game.players.size });
  console.log(`Voting started for game ${game.gameId}: ${drawingsArr.length} drawings`);
}

function showDrawResults(game) {
  if (game.resultsShown) return;
  game.resultsShown = true;

  const results = gameManager.tallyVotes(game.gameId);
  const scores = gameManager.calculateScores(game.gameId);

  io.to(game.pin).emit('game:draw_results', {
    results,
    scores: scores.map(s => ({ nickname: s.nickname, score: s.score })),
    roundNumber: game.currentRound,
    totalRounds: game.rounds
  });
  console.log(`Draw results shown for game ${game.gameId}, round ${game.currentRound}`);
}

function showWordResults(game) {
  if (game.resultsShown) return;
  game.resultsShown = true;

  if (game.wordTimeout) { clearTimeout(game.wordTimeout); game.wordTimeout = null; }

  // Anyone who hasn't submitted gets a zero score
  for (const [socketId, player] of game.players.entries()) {
    if (!player.answered) {
      gameManager.submitWords(game.gameId, socketId, []);
    }
  }

  const results = gameManager.getWordResults(game.gameId);

  io.to(game.pin).emit('game:word_results', {
    baseWord: game.baseWord,
    results
  });
  console.log(`Word results shown for game ${game.gameId}`);
}

function startBingoCalling(game) {
  if (game.bingoInterval || game.resultsShown) return;

  // Auto-pick numbers for anyone who hasn't chosen
  for (const [socketId, player] of game.players.entries()) {
    if (!player.answered) {
      const nums = gameManager.submitBingoNumbers(game.gameId, socketId, []);
      io.to(socketId).emit('player:bingo_numbers_confirmed', { numbers: nums });
    }
  }

  io.to(game.pin).emit('game:bingo_calling_start');

  game.bingoInterval = setInterval(() => {
    const number = gameManager.callNextBingoNumber(game.gameId);
    if (number === null) {
      clearInterval(game.bingoInterval);
      game.bingoInterval = null;
      showBingoResults(game);
      return;
    }
    io.to(game.pin).emit('game:bingo_number', { number, calledNumbers: game.calledNumbers });
  }, 7000);
}

function showBingoResults(game) {
  if (game.resultsShown) return;
  game.resultsShown = true;

  if (game.bingoInterval) { clearInterval(game.bingoInterval); game.bingoInterval = null; }
  if (game.bingoPickTimeout) { clearTimeout(game.bingoPickTimeout); game.bingoPickTimeout = null; }

  const scores = gameManager.calculateScores(game.gameId);

  io.to(game.pin).emit('game:bingo_results', {
    scores: scores.map(s => ({ nickname: s.nickname, score: s.score })),
    calledNumbers: game.calledNumbers
  });
  console.log(`Bingo results shown for game ${game.gameId}`);
}

function endGameLogic(gameId, socket) {
  const game = gameManager.getGame(gameId);
  if (!game) return;

  if (game.bingoInterval) { clearInterval(game.bingoInterval); game.bingoInterval = null; }
  if (game.bingoPickTimeout) { clearTimeout(game.bingoPickTimeout); game.bingoPickTimeout = null; }
  if (game.wordTimeout) { clearTimeout(game.wordTimeout); game.wordTimeout = null; }

  const finalScores = gameManager.calculateScores(gameId);

  // Update DB leaderboard
  const scoresForDb = finalScores.map(s => ({ nicknameId: s.nicknameId, score: s.score }));
  db.updateLeaderboardAfterGame(scoresForDb);
  db.updateGameSessionStatus(game.pin, 'finished');

  const leaderboard = db.getLeaderboard();

  io.to(game.pin).emit('game:end', {
    finalScores: finalScores.map(s => ({ nickname: s.nickname, score: s.score })),
    leaderboard
  });

  gameManager.endGame(gameId);
  console.log(`Game ended: ${gameId}`);
}

function handleDisconnect(socketId) {
  // We need to find the game this socket belongs to
  // gameManager doesn't expose all games, so we'll add a simple approach
  // by checking each game. We'll expose a helper.
  const allGames = gameManager.getAllGames ? gameManager.getAllGames() : [];
  for (const game of allGames) {
    if (game.players.has(socketId)) {
      const player = game.players.get(socketId);
      gameManager.removePlayer(game.gameId, socketId);

      const players = [];
      for (const p of game.players.values()) {
        players.push(p.nickname);
      }

      // Notify host
      io.to(game.hostSocketId).emit('lobby:player_joined', { players });
      console.log(`Player ${player.nickname} disconnected from game ${game.gameId}`);
      break;
    }
  }
}

server.listen(PORT, () => {
  console.log(`Hilly Quiz server running on http://localhost:${PORT}`);
});
