// In-memory game state manager

const fs = require('fs');
const path = require('path');
const wordGameWords = require('./wordGameWords');
const db = require('../db');

const games = new Map(); // gameId -> game object

let DICTIONARY = null;
function getDictionary() {
  if (!DICTIONARY) {
    const wordListPath = path.join(__dirname, '..', '..', 'node_modules', 'word-list', 'words.txt');
    const data = fs.readFileSync(wordListPath, 'utf8');
    DICTIONARY = new Set(data.split('\n'));
  }
  return DICTIONARY;
}

function generateGameId() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function createGame(pin, categoryId, questions, hostSocketId, questionCount) {
  const gameId = pin; // pin == gameId for simplicity
  const game = {
    gameId,
    pin,
    mode: 'quiz',
    categoryId,
    hostSocketId,
    players: new Map(), // socketId -> { nickname, nicknameId, score, answered }
    questions: questions.slice(0, questionCount || questions.length),
    currentQuestionIndex: -1,
    status: 'lobby',
    answers: new Map(), // questionId -> Map(socketId -> answer)
    questionCount: questionCount || questions.length
  };
  games.set(gameId, game);
  return gameId;
}

function createDrawGame(pin, topic, words, hostSocketId, rounds) {
  const gameId = pin; // pin == gameId for simplicity
  const game = {
    gameId,
    pin,
    mode: 'draw',
    topic,
    words,
    hostSocketId,
    players: new Map(), // socketId -> { nickname, nicknameId, score, answered }
    rounds: rounds || 5,
    currentRound: 0,
    usedWords: new Set(),
    currentWord: null,
    drawings: new Map(), // socketId -> dataUrl
    votes: new Map(), // voterSocketId -> votedForSocketId
    votingStarted: false,
    resultsShown: false,
    status: 'lobby'
  };
  games.set(gameId, game);
  return gameId;
}

function createWordGame(pin, hostSocketId, timeLimit) {
  const gameId = pin; // pin == gameId for simplicity
  const dbWords = db.getWordSplashWords().map(w => w.word);
  const words = dbWords.length > 0 ? dbWords : wordGameWords;
  const baseWord = words[Math.floor(Math.random() * words.length)];
  const game = {
    gameId,
    pin,
    mode: 'word',
    baseWord,
    hostSocketId,
    players: new Map(), // socketId -> { nickname, nicknameId, score, answered }
    timeLimit: timeLimit || 120,
    submissions: new Map(), // socketId -> { words, score }
    resultsShown: false,
    status: 'lobby'
  };
  games.set(gameId, game);
  return gameId;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createBingoGame(pin, hostSocketId) {
  const gameId = pin; // pin == gameId for simplicity
  const game = {
    gameId,
    pin,
    mode: 'bingo',
    hostSocketId,
    players: new Map(), // socketId -> { nickname, nicknameId, score, answered, bingoNumbers, bingoMarked }
    calledNumbers: [],
    remainingNumbers: shuffle(Array.from({ length: 90 }, (_, i) => i + 1)),
    lineWinner: null,
    fullHouseWinner: null,
    resultsShown: false,
    status: 'lobby'
  };
  games.set(gameId, game);
  return gameId;
}

function submitBingoNumbers(gameId, socketId, numbers) {
  const game = games.get(gameId);
  if (!game) return null;
  const player = game.players.get(socketId);
  if (!player) return null;

  const unique = [...new Set((numbers || []).map(n => parseInt(n)).filter(n => n >= 1 && n <= 90 && !isNaN(n)))];
  const nums = unique.slice(0, 9);
  while (nums.length < 9) {
    const r = Math.floor(Math.random() * 90) + 1;
    if (!nums.includes(r)) nums.push(r);
  }
  nums.sort((a, b) => a - b);

  player.bingoNumbers = nums;
  player.bingoMarked = [];
  player.answered = true;
  return nums;
}

function callNextBingoNumber(gameId) {
  const game = games.get(gameId);
  if (!game) return null;
  if (game.remainingNumbers.length === 0) return null;

  const number = game.remainingNumbers.pop();
  game.calledNumbers.push(number);

  for (const player of game.players.values()) {
    if (player.bingoNumbers && player.bingoNumbers.includes(number)) {
      player.bingoMarked.push(number);
    }
  }
  return number;
}

function checkBingoLine(player) {
  if (!player.bingoNumbers) return false;
  for (let r = 0; r < 3; r++) {
    const row = player.bingoNumbers.slice(r * 3, r * 3 + 3);
    if (row.every(n => player.bingoMarked.includes(n))) return true;
  }
  return false;
}

function checkBingoFullHouse(player) {
  if (!player.bingoNumbers) return false;
  return player.bingoNumbers.every(n => player.bingoMarked.includes(n));
}

function claimBingo(gameId, socketId, type) {
  const game = games.get(gameId);
  if (!game) return { success: false, reason: 'no_game' };
  const player = game.players.get(socketId);
  if (!player) return { success: false, reason: 'no_player' };

  if (type === 'line') {
    if (game.lineWinner) return { success: false, reason: 'already_claimed' };
    if (!checkBingoLine(player)) return { success: false, reason: 'invalid' };
    game.lineWinner = socketId;
    player.score += 500;
    return { success: true, nickname: player.nickname, points: 500 };
  }

  if (type === 'fullhouse') {
    if (game.fullHouseWinner) return { success: false, reason: 'already_claimed' };
    if (!checkBingoFullHouse(player)) return { success: false, reason: 'invalid' };
    game.fullHouseWinner = socketId;
    player.score += 1000;
    return { success: true, nickname: player.nickname, points: 1000 };
  }

  return { success: false, reason: 'unknown_type' };
}

function getLetterCounts(word) {
  const counts = {};
  for (const ch of word.toLowerCase()) {
    counts[ch] = (counts[ch] || 0) + 1;
  }
  return counts;
}

function canFormWord(word, baseCounts) {
  const counts = {};
  for (const ch of word) {
    counts[ch] = (counts[ch] || 0) + 1;
    if (!baseCounts[ch] || counts[ch] > baseCounts[ch]) return false;
  }
  return true;
}

function submitWords(gameId, socketId, words) {
  const game = games.get(gameId);
  if (!game) return null;
  if (game.submissions.has(socketId)) return game.submissions.get(socketId);

  const baseCounts = getLetterCounts(game.baseWord);
  const dictionary = getDictionary();
  const valid = [];
  const seen = new Set();

  for (const raw of (words || [])) {
    const word = String(raw).trim().toLowerCase();
    if (word.length < 3) continue;
    if (seen.has(word)) continue;
    if (!canFormWord(word, baseCounts)) continue;
    if (!dictionary.has(word)) continue;
    seen.add(word);
    valid.push(word);
  }

  const score = valid.reduce((sum, w) => sum + Math.max(0, w.length - 2) * 10, 0);

  const player = game.players.get(socketId);
  if (player) {
    player.score += score;
    player.answered = true;
  }

  const result = { words: valid, score };
  game.submissions.set(socketId, result);
  return result;
}

function getWordResults(gameId) {
  const game = games.get(gameId);
  if (!game) return [];

  const results = [];
  for (const [socketId, player] of game.players.entries()) {
    const sub = game.submissions.get(socketId) || { words: [], score: 0 };
    results.push({
      socketId,
      nickname: player.nickname,
      words: sub.words,
      roundScore: sub.score,
      totalScore: player.score
    });
  }

  results.sort((a, b) => b.totalScore - a.totalScore);
  return results;
}

function pickWord(gameId) {
  const game = games.get(gameId);
  if (!game) return null;

  const words = game.words && game.words.length > 0 ? game.words : ['Cat'];
  let available = words.filter(w => !game.usedWords.has(w));
  if (available.length === 0) {
    game.usedWords.clear();
    available = words;
  }

  const word = available[Math.floor(Math.random() * available.length)];
  game.usedWords.add(word);
  game.currentWord = word;
  game.currentRound++;
  game.drawings.clear();
  game.votes.clear();
  game.votingStarted = false;
  game.resultsShown = false;

  for (const player of game.players.values()) {
    player.answered = false;
  }

  return word;
}

function submitDrawing(gameId, socketId, drawing) {
  const game = games.get(gameId);
  if (!game) return false;

  game.drawings.set(socketId, drawing);

  const player = game.players.get(socketId);
  if (player) {
    player.answered = true;
  }

  return true;
}

function recordVote(gameId, voterSocketId, votedFor) {
  const game = games.get(gameId);
  if (!game) return false;
  if (game.votes.has(voterSocketId)) return false;

  game.votes.set(voterSocketId, votedFor);
  return true;
}

function tallyVotes(gameId) {
  const game = games.get(gameId);
  if (!game) return [];

  const voteCounts = new Map();
  for (const votedFor of game.votes.values()) {
    voteCounts.set(votedFor, (voteCounts.get(votedFor) || 0) + 1);
  }

  const results = [];
  for (const [socketId, image] of game.drawings.entries()) {
    const votes = voteCounts.get(socketId) || 0;
    const player = game.players.get(socketId);
    if (player) {
      player.score += votes * 50;
    }
    results.push({
      socketId,
      nickname: player ? player.nickname : 'Unknown',
      image,
      votes
    });
  }

  results.sort((a, b) => b.votes - a.votes);
  return results;
}

function getGame(gameId) {
  return games.get(gameId) || null;
}

function getGameByPin(pin) {
  return games.get(pin) || null;
}

function addPlayer(gameId, socketId, nickname, nicknameId) {
  const game = games.get(gameId);
  if (!game) return false;
  game.players.set(socketId, {
    nickname,
    nicknameId,
    score: 0,
    answered: false
  });
  return true;
}

function removePlayer(gameId, socketId) {
  const game = games.get(gameId);
  if (!game) return false;
  game.players.delete(socketId);
  return true;
}

function recordAnswer(gameId, questionId, socketId, answer) {
  const game = games.get(gameId);
  if (!game) return false;

  if (!game.answers.has(questionId)) {
    game.answers.set(questionId, new Map());
  }
  game.answers.get(questionId).set(socketId, answer);

  // Mark player as answered
  const player = game.players.get(socketId);
  if (player) {
    player.answered = true;
  }

  return true;
}

function getCurrentQuestion(gameId) {
  const game = games.get(gameId);
  if (!game) return null;
  if (game.currentQuestionIndex < 0 || game.currentQuestionIndex >= game.questions.length) {
    return null;
  }
  return game.questions[game.currentQuestionIndex];
}

function nextQuestion(gameId) {
  const game = games.get(gameId);
  if (!game) return null;

  // Reset answered status for all players
  for (const player of game.players.values()) {
    player.answered = false;
  }

  game.currentQuestionIndex++;

  if (game.currentQuestionIndex >= game.questions.length) {
    return null; // No more questions
  }

  return game.questions[game.currentQuestionIndex];
}

function calculateScores(gameId) {
  const game = games.get(gameId);
  if (!game) return [];

  const scores = [];
  for (const [socketId, player] of game.players.entries()) {
    scores.push({
      socketId,
      nickname: player.nickname,
      nicknameId: player.nicknameId,
      score: player.score
    });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);
  return scores;
}

function endGame(gameId) {
  games.delete(gameId);
}

function getAllGames() {
  return Array.from(games.values());
}

module.exports = {
  createGame,
  createDrawGame,
  createWordGame,
  createBingoGame,
  submitBingoNumbers,
  callNextBingoNumber,
  claimBingo,
  submitWords,
  getWordResults,
  getGame,
  getGameByPin,
  addPlayer,
  removePlayer,
  recordAnswer,
  getCurrentQuestion,
  nextQuestion,
  calculateScores,
  endGame,
  getAllGames,
  pickWord,
  submitDrawing,
  recordVote,
  tallyVotes
};
