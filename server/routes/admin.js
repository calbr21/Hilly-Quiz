const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/admin/categories
router.get('/categories', (req, res) => {
  try {
    const categories = db.getCategories();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/categories
router.post('/categories', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const result = db.db.prepare('INSERT INTO categories (name, is_custom) VALUES (?, 1)').run(name.trim());
    const category = db.db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/categories/:id — deletes the category and all its questions
router.delete('/categories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.deleteCategory(parseInt(id));
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/categories/:id/questions — deletes all questions in a category
router.delete('/categories/:id/questions', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.deleteQuestionsByCategory(parseInt(id));
    res.json({ success: true, deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/draw-categories
router.get('/draw-categories', (req, res) => {
  try {
    res.json(db.getDrawCategories());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/draw-categories
router.post('/draw-categories', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const category = db.addDrawCategory(name.trim());
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/draw-categories/:id — deletes the category and all its words
router.delete('/draw-categories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.deleteDrawCategory(parseInt(id));
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/draw-categories/:id/words — deletes all words in a category
router.delete('/draw-categories/:id/words', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.deleteDrawWordsByCategory(parseInt(id));
    res.json({ success: true, deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/draw-words?categoryId=
router.get('/draw-words', (req, res) => {
  try {
    const { categoryId } = req.query;
    const words = db.getDrawWords(categoryId ? parseInt(categoryId) : null);
    res.json(words);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/draw-words
router.post('/draw-words', (req, res) => {
  try {
    const { category_id, word } = req.body;
    if (!category_id || !word || !word.trim()) {
      return res.status(400).json({ error: 'category_id and word are required' });
    }
    const result = db.addDrawWord(parseInt(category_id), word.trim());
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/draw-words/bulk
router.post('/draw-words/bulk', (req, res) => {
  try {
    const { category_id, words } = req.body;
    if (!category_id || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: 'category_id and words array are required' });
    }
    let imported = 0;
    for (const word of words) {
      const trimmed = (word || '').trim();
      if (!trimmed) continue;
      db.addDrawWord(parseInt(category_id), trimmed);
      imported++;
    }
    res.json({ success: true, imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/draw-words/:id
router.delete('/draw-words/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.deleteDrawWord(parseInt(id));
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Word not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/word-splash-words
router.get('/word-splash-words', (req, res) => {
  try {
    res.json(db.getWordSplashWords());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/word-splash-words
router.post('/word-splash-words', (req, res) => {
  try {
    const { word } = req.body;
    if (!word || !word.trim()) {
      return res.status(400).json({ error: 'word is required' });
    }
    const result = db.addWordSplashWord(word.trim());
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/word-splash-words/bulk
router.post('/word-splash-words/bulk', (req, res) => {
  try {
    const { words } = req.body;
    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: 'words array is required' });
    }
    let imported = 0;
    for (const word of words) {
      const trimmed = (word || '').trim();
      if (!trimmed) continue;
      db.addWordSplashWord(trimmed);
      imported++;
    }
    res.json({ success: true, imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/word-splash-words — deletes all words
router.delete('/word-splash-words', (req, res) => {
  try {
    const result = db.deleteAllWordSplashWords();
    res.json({ success: true, deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/word-splash-words/:id
router.delete('/word-splash-words/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.deleteWordSplashWord(parseInt(id));
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Word not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/questions?categoryId=
router.get('/questions', (req, res) => {
  try {
    const { categoryId } = req.query;
    const questions = db.getQuestions(categoryId ? parseInt(categoryId) : null);
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/questions/bulk — must be before /:id routes
router.post('/questions/bulk', (req, res) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'questions array is required' });
    }

    const results = { imported: 0, errors: [] };

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      try {
        let category = db.db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)').get(q.category_name?.trim());
        if (!category) {
          const ins = db.db.prepare('INSERT INTO categories (name, is_custom) VALUES (?, 1)').run(q.category_name.trim());
          category = { id: ins.lastInsertRowid };
        }

        let { option_a, option_b, option_c, option_d, correct_answer } = q;
        if (q.type === 'true_false') {
          option_a = 'True';
          option_b = 'False';
          option_c = null;
          option_d = null;
          if (correct_answer === 'True') correct_answer = 'A';
          else if (correct_answer === 'False') correct_answer = 'B';
        }

        db.addQuestion({
          category_id: category.id,
          question_text: q.question_text,
          type: q.type,
          option_a: option_a || null,
          option_b: option_b || null,
          option_c: option_c || null,
          option_d: option_d || null,
          correct_answer
        });
        results.imported++;
      } catch (err) {
        results.errors.push({ row: i + 2, error: err.message });
      }
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/questions
router.post('/questions', (req, res) => {
  try {
    const { category_id, question_text, type, option_a, option_b, option_c, option_d, correct_answer } = req.body;
    if (!question_text || !type || !correct_answer || !category_id) {
      return res.status(400).json({ error: 'category_id, question_text, type, and correct_answer are required' });
    }
    const question = db.addQuestion({
      category_id,
      question_text,
      type,
      option_a: option_a || null,
      option_b: option_b || null,
      option_c: option_c || null,
      option_d: option_d || null,
      correct_answer
    });
    res.status(201).json(question);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/questions/:id
router.put('/questions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, question_text, type, option_a, option_b, option_c, option_d, correct_answer } = req.body;
    if (!question_text || !type || !correct_answer || !category_id) {
      return res.status(400).json({ error: 'category_id, question_text, type, and correct_answer are required' });
    }
    const question = db.updateQuestion(parseInt(id), {
      category_id,
      question_text,
      type,
      option_a: option_a || null,
      option_b: option_b || null,
      option_c: option_c || null,
      option_d: option_d || null,
      correct_answer
    });
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json(question);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/questions/:id
router.delete('/questions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.deleteQuestion(parseInt(id));
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
