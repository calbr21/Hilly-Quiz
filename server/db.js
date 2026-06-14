const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'hilly-quiz.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_custom INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES categories(id),
    question_text TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('multiple_choice', 'true_false')),
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    correct_answer TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS nicknames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname_id INTEGER REFERENCES nicknames(id),
    total_points INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pin TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    status TEXT DEFAULT 'lobby',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS draw_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS draw_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES draw_categories(id),
    word TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS word_splash_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL UNIQUE
  );
`);

// Seed default draw categories/words if empty
const drawCategoryCount = db.prepare('SELECT COUNT(*) as count FROM draw_categories').get();
if (drawCategoryCount.count === 0) {
  const defaultDrawTopics = require('./game/drawWords');
  const insertDrawCategory = db.prepare('INSERT INTO draw_categories (name) VALUES (?)');
  const insertDrawWord = db.prepare('INSERT INTO draw_words (category_id, word) VALUES (?, ?)');

  const seedDraw = db.transaction((topics) => {
    for (const [name, words] of Object.entries(topics)) {
      if (name === 'Random') continue;
      const result = insertDrawCategory.run(name);
      for (const word of words) {
        insertDrawWord.run(result.lastInsertRowid, word);
      }
    }
  });
  seedDraw(defaultDrawTopics);

  console.log('Database seeded with default draw categories and words.');
}

// Seed default word splash words if empty
const wordSplashCount = db.prepare('SELECT COUNT(*) as count FROM word_splash_words').get();
if (wordSplashCount.count === 0) {
  const defaultWordSplashWords = require('./game/wordGameWords');
  const insertWordSplashWord = db.prepare('INSERT OR IGNORE INTO word_splash_words (word) VALUES (?)');
  const seedWordSplash = db.transaction((words) => {
    for (const word of words) {
      insertWordSplashWord.run(word.toUpperCase());
    }
  });
  seedWordSplash(defaultWordSplashWords);

  console.log('Database seeded with default word splash words.');
}

// Seed default categories if empty
const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
if (categoryCount.count === 0) {
  const defaultCategories = [
    'General Knowledge',
    'History',
    'Science & Nature',
    'Geography',
    'Sport',
    'Music',
    'Films & TV',
    'Food & Drink',
    'Art & Literature',
    'Technology'
  ];

  const insertCategory = db.prepare('INSERT INTO categories (name, is_custom) VALUES (?, 0)');
  const insertMany = db.transaction((categories) => {
    for (const name of categories) {
      insertCategory.run(name);
    }
  });
  insertMany(defaultCategories);

  // Seed sample questions for General Knowledge (id=1)
  const gkCategoryId = db.prepare("SELECT id FROM categories WHERE name = 'General Knowledge'").get().id;
  const insertQuestion = db.prepare(`
    INSERT INTO questions (category_id, question_text, type, option_a, option_b, option_c, option_d, correct_answer)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sampleQuestions = [
    [gkCategoryId, 'What is the capital of France?', 'multiple_choice', 'Paris', 'London', 'Berlin', 'Madrid', 'A'],
    [gkCategoryId, 'How many continents are there on Earth?', 'multiple_choice', '5', '6', '7', '8', 'C'],
    [gkCategoryId, 'The Great Wall of China is visible from space.', 'true_false', 'True', 'False', null, null, 'B'],
    [gkCategoryId, 'What is the chemical symbol for water?', 'multiple_choice', 'CO2', 'H2O', 'NaCl', 'O2', 'B'],
    [gkCategoryId, 'Mount Everest is the tallest mountain in the world.', 'true_false', 'True', 'False', null, null, 'A'],
    [gkCategoryId, 'How many sides does a hexagon have?', 'multiple_choice', '5', '6', '7', '8', 'B'],
    [gkCategoryId, 'The sun is a planet.', 'true_false', 'True', 'False', null, null, 'B'],
    [gkCategoryId, 'What is 7 x 8?', 'multiple_choice', '54', '56', '58', '60', 'B'],
    [gkCategoryId, 'Sharks are mammals.', 'true_false', 'True', 'False', null, null, 'B'],
    [gkCategoryId, 'What colour is the sky on a clear day?', 'multiple_choice', 'Green', 'Yellow', 'Blue', 'Red', 'C']
  ];

  const insertMany2 = db.transaction((questions) => {
    for (const q of questions) {
      insertQuestion.run(...q);
    }
  });
  insertMany2(sampleQuestions);

  console.log('Database seeded with default categories and sample questions.');
}

// Helper functions
function getCategories() {
  return db.prepare('SELECT * FROM categories ORDER BY is_custom ASC, name ASC').all();
}

function getQuestions(categoryId) {
  if (categoryId) {
    return db.prepare('SELECT * FROM questions WHERE category_id = ? ORDER BY created_at ASC').all(categoryId);
  }
  return db.prepare('SELECT * FROM questions ORDER BY created_at ASC').all();
}

function getQuestionById(id) {
  return db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
}

function addQuestion(data) {
  const stmt = db.prepare(`
    INSERT INTO questions (category_id, question_text, type, option_a, option_b, option_c, option_d, correct_answer)
    VALUES (@category_id, @question_text, @type, @option_a, @option_b, @option_c, @option_d, @correct_answer)
  `);
  const result = stmt.run(data);
  return getQuestionById(result.lastInsertRowid);
}

function updateQuestion(id, data) {
  const stmt = db.prepare(`
    UPDATE questions SET
      category_id = @category_id,
      question_text = @question_text,
      type = @type,
      option_a = @option_a,
      option_b = @option_b,
      option_c = @option_c,
      option_d = @option_d,
      correct_answer = @correct_answer
    WHERE id = @id
  `);
  stmt.run({ ...data, id });
  return getQuestionById(id);
}

function deleteQuestion(id) {
  return db.prepare('DELETE FROM questions WHERE id = ?').run(id);
}

function deleteQuestionsByCategory(categoryId) {
  return db.prepare('DELETE FROM questions WHERE category_id = ?').run(categoryId);
}

function deleteCategory(id) {
  const tx = db.transaction((categoryId) => {
    db.prepare('UPDATE game_sessions SET category_id = NULL WHERE category_id = ?').run(categoryId);
    db.prepare('DELETE FROM questions WHERE category_id = ?').run(categoryId);
    return db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
  });
  return tx(id);
}

function getOrCreateNickname(name) {
  let nickname = db.prepare('SELECT * FROM nicknames WHERE name = ?').get(name);
  if (!nickname) {
    const result = db.prepare('INSERT INTO nicknames (name) VALUES (?)').run(name);
    nickname = db.prepare('SELECT * FROM nicknames WHERE id = ?').get(result.lastInsertRowid);
  }
  return nickname;
}

function getLeaderboard() {
  return db.prepare(`
    SELECT n.name, l.total_points, l.games_played, l.updated_at
    FROM leaderboard l
    JOIN nicknames n ON n.id = l.nickname_id
    ORDER BY l.total_points DESC, l.games_played ASC
  `).all();
}

function updateLeaderboardAfterGame(scores) {
  // scores: array of { nicknameId, score }
  const upsert = db.transaction((scores) => {
    for (const { nicknameId, score } of scores) {
      const existing = db.prepare('SELECT * FROM leaderboard WHERE nickname_id = ?').get(nicknameId);
      if (existing) {
        db.prepare(`
          UPDATE leaderboard SET
            total_points = total_points + ?,
            games_played = games_played + 1,
            updated_at = CURRENT_TIMESTAMP
          WHERE nickname_id = ?
        `).run(score, nicknameId);
      } else {
        db.prepare(`
          INSERT INTO leaderboard (nickname_id, total_points, games_played)
          VALUES (?, ?, 1)
        `).run(nicknameId, score);
      }
    }
  });
  upsert(scores);
}

function getDrawCategories() {
  return db.prepare('SELECT * FROM draw_categories ORDER BY name ASC').all();
}

function addDrawCategory(name) {
  const result = db.prepare('INSERT INTO draw_categories (name) VALUES (?)').run(name);
  return db.prepare('SELECT * FROM draw_categories WHERE id = ?').get(result.lastInsertRowid);
}

function deleteDrawCategory(id) {
  const tx = db.transaction((categoryId) => {
    db.prepare('DELETE FROM draw_words WHERE category_id = ?').run(categoryId);
    return db.prepare('DELETE FROM draw_categories WHERE id = ?').run(categoryId);
  });
  return tx(id);
}

function getDrawWords(categoryId) {
  if (categoryId) {
    return db.prepare('SELECT * FROM draw_words WHERE category_id = ? ORDER BY word ASC').all(categoryId);
  }
  return db.prepare('SELECT * FROM draw_words ORDER BY word ASC').all();
}

function addDrawWord(categoryId, word) {
  const result = db.prepare('INSERT INTO draw_words (category_id, word) VALUES (?, ?)').run(categoryId, word);
  return db.prepare('SELECT * FROM draw_words WHERE id = ?').get(result.lastInsertRowid);
}

function deleteDrawWord(id) {
  return db.prepare('DELETE FROM draw_words WHERE id = ?').run(id);
}

function deleteDrawWordsByCategory(categoryId) {
  return db.prepare('DELETE FROM draw_words WHERE category_id = ?').run(categoryId);
}

function getDrawWordsForTopic(topicName) {
  if (topicName === 'Random') {
    return db.prepare('SELECT word FROM draw_words').all().map(r => r.word);
  }
  return db.prepare(`
    SELECT w.word FROM draw_words w
    JOIN draw_categories c ON c.id = w.category_id
    WHERE c.name = ?
  `).all(topicName).map(r => r.word);
}

function getWordSplashWords() {
  return db.prepare('SELECT * FROM word_splash_words ORDER BY word ASC').all();
}

function addWordSplashWord(word) {
  const result = db.prepare('INSERT OR IGNORE INTO word_splash_words (word) VALUES (?)').run(word.toUpperCase());
  if (result.changes === 0) {
    return db.prepare('SELECT * FROM word_splash_words WHERE word = ?').get(word.toUpperCase());
  }
  return db.prepare('SELECT * FROM word_splash_words WHERE id = ?').get(result.lastInsertRowid);
}

function deleteWordSplashWord(id) {
  return db.prepare('DELETE FROM word_splash_words WHERE id = ?').run(id);
}

function deleteAllWordSplashWords() {
  return db.prepare('DELETE FROM word_splash_words').run();
}

function createGameSession(pin, categoryId) {
  const result = db.prepare('INSERT INTO game_sessions (pin, category_id) VALUES (?, ?)').run(pin, categoryId);
  return db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(result.lastInsertRowid);
}

function getGameSession(pin) {
  return db.prepare('SELECT * FROM game_sessions WHERE pin = ? ORDER BY created_at DESC LIMIT 1').get(pin);
}

function updateGameSessionStatus(pin, status) {
  return db.prepare('UPDATE game_sessions SET status = ? WHERE pin = ?').run(status, pin);
}

module.exports = {
  db,
  getCategories,
  getQuestions,
  getQuestionById,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  deleteQuestionsByCategory,
  deleteCategory,
  getOrCreateNickname,
  getLeaderboard,
  updateLeaderboardAfterGame,
  createGameSession,
  getGameSession,
  updateGameSessionStatus,
  getDrawCategories,
  addDrawCategory,
  deleteDrawCategory,
  getDrawWords,
  addDrawWord,
  deleteDrawWord,
  deleteDrawWordsByCategory,
  getDrawWordsForTopic,
  getWordSplashWords,
  addWordSplashWord,
  deleteWordSplashWord,
  deleteAllWordSplashWords
};
