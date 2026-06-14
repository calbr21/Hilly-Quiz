import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const ADMIN_USER = 'HillyQuizAdmin'
const ADMIN_PASS = 'HillyQuizAdmin'
const AUTH_KEY = 'hilly-admin-auth'

const EMPTY_FORM = {
  category_id: '',
  question_text: '',
  type: 'multiple_choice',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_answer: 'A'
}

// Simple CSV parser that handles quoted fields
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = []
    let current = ''
    let inQuotes = false
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        cols.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    cols.push(current.trim())
    rows.push(cols)
  }
  return rows
}

function LoginGate({ onAuth }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      sessionStorage.setItem(AUTH_KEY, '1')
      onAuth()
    } else {
      setError('Incorrect username or password.')
    }
  }

  return (
    <div className="page" style={{ justifyContent: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: '380px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>🔒 Admin Login</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Login
          </button>
        </form>
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Link to="/" className="nav-link">← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}

function Admin() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === '1')
  const [adminTab, setAdminTab] = useState('quiz')

  if (!authed) {
    return <LoginGate onAuth={() => setAuthed(true)} />
  }

  const onLogout = () => { sessionStorage.removeItem(AUTH_KEY); setAuthed(false) }

  return (
    <div className="page-top">
      <div className="card-wide">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>⚙️ Admin</h2>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Link to="/" className="nav-link">← Home</Link>
            <button className="btn btn-ghost btn-sm" onClick={onLogout} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
              Logout
            </button>
          </div>
        </div>

        <div className="btn-group" style={{ marginBottom: '1.5rem' }}>
          <button
            className={adminTab === 'quiz' ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => setAdminTab('quiz')}
          >
            🧠 Quiz Questions
          </button>
          <button
            className={adminTab === 'draw' ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => setAdminTab('draw')}
          >
            🎨 Draw Mode
          </button>
          <button
            className={adminTab === 'word' ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => setAdminTab('word')}
          >
            📝 Word Splash
          </button>
        </div>

        {adminTab === 'quiz' ? <QuizAdminPanel /> : adminTab === 'draw' ? <DrawAdminPanel /> : <WordSplashAdminPanel />}
      </div>
    </div>
  )
}

function QuizAdminPanel() {
  const [categories, setCategories] = useState([])
  const [questions, setQuestions] = useState([])
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)

  // CSV import state
  const [showImport, setShowImport] = useState(false)
  const [csvRows, setCsvRows] = useState([])
  const [csvError, setCsvError] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)

  const fetchCategories = () => {
    fetch('/api/admin/categories')
      .then(r => r.json())
      .then(setCategories)
      .catch(() => {})
  }

  const fetchQuestions = (catId) => {
    const url = catId ? `/api/admin/questions?categoryId=${catId}` : '/api/admin/questions'
    fetch(url)
      .then(r => r.json())
      .then(setQuestions)
      .catch(() => {})
  }

  useEffect(() => {
    fetchCategories()
    fetchQuestions('')
  }, [])

  useEffect(() => {
    fetchQuestions(filterCategoryId)
  }, [filterCategoryId])

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setForm(prev => {
      const updated = { ...prev, [name]: value }
      if (name === 'type' && value === 'true_false') {
        updated.option_a = 'True'
        updated.option_b = 'False'
        updated.option_c = ''
        updated.option_d = ''
        if (!['A', 'B'].includes(updated.correct_answer)) {
          updated.correct_answer = 'A'
        }
      }
      return updated
    })
  }

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, category_id: categories[0]?.id || '' })
    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  const handleEdit = (q) => {
    setForm({
      category_id: q.category_id,
      question_text: q.question_text,
      type: q.type,
      option_a: q.option_a || '',
      option_b: q.option_b || '',
      option_c: q.option_c || '',
      option_d: q.option_d || '',
      correct_answer: q.correct_answer
    })
    setEditingId(q.id)
    setShowForm(true)
    setError('')
    setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question?')) return
    try {
      const r = await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Delete failed')
      setSuccess('Question deleted.')
      fetchQuestions(filterCategoryId)
    } catch {
      setError('Failed to delete question.')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const payload = {
      ...form,
      category_id: parseInt(form.category_id),
      option_c: form.type === 'true_false' ? null : (form.option_c || null),
      option_d: form.type === 'true_false' ? null : (form.option_d || null)
    }

    try {
      const url = editingId ? `/api/admin/questions/${editingId}` : '/api/admin/questions'
      const method = editingId ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!r.ok) {
        const data = await r.json()
        throw new Error(data.error || 'Request failed')
      }
      setSuccess(editingId ? 'Question updated!' : 'Question added!')
      resetForm()
      fetchQuestions(filterCategoryId)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    try {
      const r = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() })
      })
      if (!r.ok) throw new Error('Failed')
      setNewCatName('')
      setShowNewCat(false)
      fetchCategories()
      setSuccess('Category added!')
    } catch {
      setError('Failed to add category.')
    }
  }

  const handleDeleteCategoryQuestions = async () => {
    if (!filterCategoryId) return
    const catName = getCategoryName(parseInt(filterCategoryId))
    if (!window.confirm(`Delete ALL questions in "${catName}"? This cannot be undone.`)) return
    try {
      const r = await fetch(`/api/admin/categories/${filterCategoryId}/questions`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Delete failed')
      const data = await r.json()
      setSuccess(`Deleted ${data.deleted} question${data.deleted !== 1 ? 's' : ''} from "${catName}".`)
      fetchQuestions(filterCategoryId)
    } catch {
      setError('Failed to delete questions for this category.')
    }
  }

  const handleDeleteCategory = async () => {
    if (!filterCategoryId) return
    const catName = getCategoryName(parseInt(filterCategoryId))
    if (!window.confirm(`Delete the category "${catName}" and ALL its questions? This cannot be undone.`)) return
    try {
      const r = await fetch(`/api/admin/categories/${filterCategoryId}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Delete failed')
      setSuccess(`Category "${catName}" deleted.`)
      setFilterCategoryId('')
      fetchCategories()
      fetchQuestions('')
    } catch {
      setError('Failed to delete category.')
    }
  }

  const getCategoryName = (id) => {
    const cat = categories.find(c => c.id === id)
    return cat ? cat.name : 'Unknown'
  }

  // ── CSV Import ──────────────────────────────────────────────
  const downloadTemplate = () => {
    const header = 'category_name,question_text,type,option_a,option_b,option_c,option_d,correct_answer'
    const example1 = 'General Knowledge,What is the capital of France?,multiple_choice,Paris,London,Berlin,Madrid,A'
    const example2 = 'General Knowledge,The sun is a planet.,true_false,True,False,,,B'
    const blob = new Blob([header + '\n' + example1 + '\n' + example2], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'hilly-quiz-questions-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileChange = (e) => {
    setCsvError('')
    setCsvRows([])
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target.result)
        if (rows.length === 0) {
          setCsvError('No data rows found. Make sure the file has a header row and at least one data row.')
          return
        }
        const parsed = rows.map((cols, i) => {
          const [category_name, question_text, type, option_a, option_b, option_c, option_d, correct_answer] = cols
          return { category_name, question_text, type, option_a, option_b, option_c, option_d, correct_answer, _row: i + 2 }
        })
        // Basic validation preview
        const invalid = parsed.filter(r =>
          !r.category_name || !r.question_text || !r.type || !r.correct_answer ||
          !['multiple_choice', 'true_false'].includes(r.type) ||
          !['A', 'B', 'C', 'D', 'True', 'False'].includes(r.correct_answer)
        )
        if (invalid.length > 0) {
          setCsvError(`${invalid.length} row(s) have missing or invalid data (rows: ${invalid.map(r => r._row).join(', ')}). Check type is "multiple_choice" or "true_false", and correct_answer is A/B/C/D or True/False.`)
        }
        setCsvRows(parsed)
      } catch (err) {
        setCsvError('Failed to parse CSV: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (csvRows.length === 0) return
    setImporting(true)
    setCsvError('')
    try {
      const r = await fetch('/api/admin/questions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: csvRows })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Import failed')
      setSuccess(`Imported ${data.imported} question${data.imported !== 1 ? 's' : ''}!${data.errors.length > 0 ? ` (${data.errors.length} skipped with errors)` : ''}`)
      setCsvRows([])
      setShowImport(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      fetchCategories()
      fetchQuestions(filterCategoryId)
    } catch (err) {
      setCsvError(err.message)
    } finally {
      setImporting(false)
    }
  }
  // ────────────────────────────────────────────────────────────

  const correctAnswerOptions = form.type === 'true_false' ? ['A', 'B'] : ['A', 'B', 'C', 'D']

  return (
    <>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* Add/Edit Form */}
        {showForm && (
          <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3>{editingId ? 'Edit Question' : 'Add New Question'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Category</label>
                  <select name="category_id" value={form.category_id} onChange={handleFormChange} required>
                    <option value="">Select category...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select name="type" value={form.type} onChange={handleFormChange}>
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="true_false">True / False</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Question Text</label>
                <textarea
                  name="question_text"
                  value={form.question_text}
                  onChange={handleFormChange}
                  required
                  placeholder="Enter the question..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ color: '#7C3AED' }}>Option A</label>
                  <input name="option_a" value={form.option_a} onChange={handleFormChange} placeholder="Option A" required />
                </div>
                <div className="form-group">
                  <label style={{ color: '#0D9488' }}>Option B</label>
                  <input name="option_b" value={form.option_b} onChange={handleFormChange} placeholder="Option B" required />
                </div>
                {form.type === 'multiple_choice' && (
                  <>
                    <div className="form-group">
                      <label style={{ color: '#EA580C' }}>Option C</label>
                      <input name="option_c" value={form.option_c} onChange={handleFormChange} placeholder="Option C" />
                    </div>
                    <div className="form-group">
                      <label style={{ color: '#D97706' }}>Option D</label>
                      <input name="option_d" value={form.option_d} onChange={handleFormChange} placeholder="Option D" />
                    </div>
                  </>
                )}
              </div>

              <div className="form-group">
                <label>Correct Answer</label>
                <select name="correct_answer" value={form.correct_answer} onChange={handleFormChange}>
                  {correctAnswerOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="btn-group">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : editingId ? 'Update Question' : 'Add Question'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* CSV Import Panel */}
        {showImport && (
          <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>📥 Import from Spreadsheet (CSV)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Export your spreadsheet as a CSV file. Required columns (in order):
              <br />
              <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', display: 'inline-block', marginTop: '0.4rem' }}>
                category_name, question_text, type, option_a, option_b, option_c, option_d, correct_answer
              </code>
              <br />
              <span style={{ fontSize: '0.8rem', marginTop: '0.4rem', display: 'inline-block' }}>
                <strong>type</strong>: <code>multiple_choice</code> or <code>true_false</code> &nbsp;|&nbsp;
                <strong>correct_answer</strong>: <code>A</code>, <code>B</code>, <code>C</code>, <code>D</code>, <code>True</code>, or <code>False</code>
              </span>
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-ghost btn-sm" onClick={downloadTemplate} style={{ whiteSpace: 'nowrap' }}>
                ⬇ Download Template
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                style={{ color: 'white', fontSize: '0.9rem' }}
              />
            </div>

            {csvError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{csvError}</div>}

            {csvRows.length > 0 && (
              <>
                <div style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {csvRows.length} row{csvRows.length !== 1 ? 's' : ''} ready to import:
                </div>
                <div className="table-wrap" style={{ maxHeight: '240px', overflowY: 'auto', marginBottom: '1rem' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Question</th>
                        <th>Type</th>
                        <th>Answer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, i) => (
                        <tr key={i}>
                          <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{row.category_name}</td>
                          <td style={{ fontSize: '0.8rem', maxWidth: '220px' }}>{row.question_text}</td>
                          <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{row.type === 'true_false' ? 'T/F' : 'MCQ'}</td>
                          <td style={{ fontSize: '0.8rem', fontWeight: '700' }}>{row.correct_answer}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="btn-group">
                  <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
                    {importing ? 'Importing...' : `Import ${csvRows.length} Question${csvRows.length !== 1 ? 's' : ''}`}
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setCsvRows([]); setCsvError(''); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                    Clear
                  </button>
                </div>
              </>
            )}

            <div style={{ marginTop: '1rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowImport(false); setCsvRows([]); setCsvError('') }}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: '1', minWidth: '180px' }}>
            <label>Filter by Category</label>
            <select value={filterCategoryId} onChange={e => setFilterCategoryId(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {!showForm && (
            <button
              className="btn btn-primary btn-sm"
              style={{ marginBottom: 0, whiteSpace: 'nowrap' }}
              onClick={() => {
                setForm({ ...EMPTY_FORM, category_id: filterCategoryId || categories[0]?.id || '' })
                setEditingId(null)
                setShowForm(true)
                setShowImport(false)
              }}
            >
              + Add Question
            </button>
          )}

          <button
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: 0, whiteSpace: 'nowrap' }}
            onClick={() => { setShowNewCat(!showNewCat); setShowImport(false) }}
          >
            + New Category
          </button>

          <button
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: 0, whiteSpace: 'nowrap' }}
            onClick={() => { setShowImport(!showImport); setShowForm(false); setShowNewCat(false) }}
          >
            📥 Import CSV
          </button>

          {filterCategoryId && (
            <>
              <button
                className="btn btn-danger btn-sm"
                style={{ marginBottom: 0, whiteSpace: 'nowrap' }}
                onClick={handleDeleteCategoryQuestions}
              >
                🗑 Delete All Questions in Category
              </button>
              <button
                className="btn btn-danger btn-sm"
                style={{ marginBottom: 0, whiteSpace: 'nowrap' }}
                onClick={handleDeleteCategory}
              >
                🗑 Delete Category
              </button>
            </>
          )}
        </div>

        {/* New Category form */}
        {showNewCat && (
          <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <input
              type="text"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="Category name"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-success btn-sm">Add</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNewCat(false)}>Cancel</button>
          </form>
        )}

        {/* Questions Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Category</th>
                <th>Type</th>
                <th>Options</th>
                <th>Answer</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No questions found.
                  </td>
                </tr>
              )}
              {questions.map(q => (
                <tr key={q.id}>
                  <td style={{ maxWidth: '250px' }}>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{q.question_text}</div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {getCategoryName(q.category_id)}
                  </td>
                  <td>
                    <span style={{
                      background: q.type === 'true_false' ? 'rgba(13, 148, 136, 0.3)' : 'rgba(124, 58, 237, 0.3)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      whiteSpace: 'nowrap'
                    }}>
                      {q.type === 'true_false' ? 'T/F' : 'MCQ'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <div><span style={{ color: '#7C3AED' }}>A:</span> {q.option_a}</div>
                    <div><span style={{ color: '#0D9488' }}>B:</span> {q.option_b}</div>
                    {q.option_c && <div><span style={{ color: '#EA580C' }}>C:</span> {q.option_c}</div>}
                    {q.option_d && <div><span style={{ color: '#D97706' }}>D:</span> {q.option_d}</div>}
                  </td>
                  <td>
                    <span style={{
                      background: 'rgba(34, 197, 94, 0.2)',
                      color: '#86efac',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      fontWeight: '700',
                      fontSize: '0.9rem'
                    }}>
                      {q.correct_answer}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEdit(q)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(q.id)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center mt-4" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {questions.length} question{questions.length !== 1 ? 's' : ''} shown
        </div>
    </>
  )
}

function DrawAdminPanel() {
  const [categories, setCategories] = useState([])
  const [words, setWords] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [newCatName, setNewCatName] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)
  const [newWord, setNewWord] = useState('')
  const [bulkWords, setBulkWords] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchCategories = () => {
    fetch('/api/admin/draw-categories')
      .then(r => r.json())
      .then(setCategories)
      .catch(() => {})
  }

  const fetchWords = (catId) => {
    const url = catId ? `/api/admin/draw-words?categoryId=${catId}` : '/api/admin/draw-words'
    fetch(url)
      .then(r => r.json())
      .then(setWords)
      .catch(() => {})
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    if (selectedCategoryId) {
      fetchWords(selectedCategoryId)
    } else {
      setWords([])
    }
  }, [selectedCategoryId])

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id)
    }
  }, [categories])

  const getCategoryName = (id) => {
    const cat = categories.find(c => c.id === id)
    return cat ? cat.name : 'Unknown'
  }

  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    setError('')
    setSuccess('')
    try {
      const r = await fetch('/api/admin/draw-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() })
      })
      if (!r.ok) {
        const data = await r.json()
        throw new Error(data.error || 'Failed')
      }
      const category = await r.json()
      setNewCatName('')
      setShowNewCat(false)
      fetchCategories()
      setSelectedCategoryId(category.id)
      setSuccess('Category added!')
    } catch (err) {
      setError(err.message || 'Failed to add category.')
    }
  }

  const handleDeleteCategory = async () => {
    if (!selectedCategoryId) return
    const catName = getCategoryName(parseInt(selectedCategoryId))
    if (!window.confirm(`Delete the category "${catName}" and ALL its words? This cannot be undone.`)) return
    setError('')
    setSuccess('')
    try {
      const r = await fetch(`/api/admin/draw-categories/${selectedCategoryId}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Delete failed')
      setSuccess(`Category "${catName}" deleted.`)
      setSelectedCategoryId('')
      fetchCategories()
    } catch {
      setError('Failed to delete category.')
    }
  }

  const handleDeleteAllWords = async () => {
    if (!selectedCategoryId) return
    const catName = getCategoryName(parseInt(selectedCategoryId))
    if (!window.confirm(`Delete ALL words in "${catName}"? This cannot be undone.`)) return
    setError('')
    setSuccess('')
    try {
      const r = await fetch(`/api/admin/draw-categories/${selectedCategoryId}/words`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Delete failed')
      const data = await r.json()
      setSuccess(`Deleted ${data.deleted} word${data.deleted !== 1 ? 's' : ''} from "${catName}".`)
      fetchWords(selectedCategoryId)
    } catch {
      setError('Failed to delete words for this category.')
    }
  }

  const handleAddWord = async (e) => {
    e.preventDefault()
    if (!newWord.trim() || !selectedCategoryId) return
    setError('')
    setSuccess('')
    try {
      const r = await fetch('/api/admin/draw-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: parseInt(selectedCategoryId), word: newWord.trim() })
      })
      if (!r.ok) {
        const data = await r.json()
        throw new Error(data.error || 'Failed')
      }
      setNewWord('')
      fetchWords(selectedCategoryId)
    } catch (err) {
      setError(err.message || 'Failed to add word.')
    }
  }

  const handleBulkAddWords = async (e) => {
    e.preventDefault()
    if (!bulkWords.trim() || !selectedCategoryId) return
    setError('')
    setSuccess('')
    const wordList = bulkWords.split(/[\n,]/).map(w => w.trim()).filter(Boolean)
    if (wordList.length === 0) return
    try {
      const r = await fetch('/api/admin/draw-words/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: parseInt(selectedCategoryId), words: wordList })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Import failed')
      setSuccess(`Added ${data.imported} word${data.imported !== 1 ? 's' : ''}!`)
      setBulkWords('')
      setShowBulk(false)
      fetchWords(selectedCategoryId)
    } catch (err) {
      setError(err.message || 'Failed to add words.')
    }
  }

  const handleDeleteWord = async (id) => {
    setError('')
    setSuccess('')
    try {
      const r = await fetch(`/api/admin/draw-words/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Delete failed')
      fetchWords(selectedCategoryId)
    } catch {
      setError('Failed to delete word.')
    }
  }

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0, flex: '1', minWidth: '180px' }}>
          <label>Category</label>
          <select value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)}>
            <option value="">Select category...</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: 0, whiteSpace: 'nowrap' }}
          onClick={() => { setShowNewCat(!showNewCat); setShowBulk(false) }}
        >
          + New Category
        </button>

        <button
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: 0, whiteSpace: 'nowrap' }}
          onClick={() => { setShowBulk(!showBulk); setShowNewCat(false) }}
          disabled={!selectedCategoryId}
        >
          📥 Bulk Add Words
        </button>

        {selectedCategoryId && (
          <>
            <button
              className="btn btn-danger btn-sm"
              style={{ marginBottom: 0, whiteSpace: 'nowrap' }}
              onClick={handleDeleteAllWords}
            >
              🗑 Delete All Words in Category
            </button>
            <button
              className="btn btn-danger btn-sm"
              style={{ marginBottom: 0, whiteSpace: 'nowrap' }}
              onClick={handleDeleteCategory}
            >
              🗑 Delete Category
            </button>
          </>
        )}
      </div>

      {/* New Category form */}
      {showNewCat && (
        <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <input
            type="text"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="Category name"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-success btn-sm">Add</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNewCat(false)}>Cancel</button>
        </form>
      )}

      {/* Bulk add words */}
      {showBulk && (
        <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>📥 Bulk Add Words</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Enter one word per line (or comma-separated). They'll be added to <strong>{getCategoryName(parseInt(selectedCategoryId))}</strong>.
          </p>
          <form onSubmit={handleBulkAddWords}>
            <div className="form-group">
              <textarea
                value={bulkWords}
                onChange={e => setBulkWords(e.target.value)}
                placeholder={'Dog\nCat\nElephant\n...'}
                rows={6}
              />
            </div>
            <div className="btn-group">
              <button type="submit" className="btn btn-primary">Add Words</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowBulk(false); setBulkWords('') }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Add single word */}
      {selectedCategoryId && (
        <form onSubmit={handleAddWord} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <input
            type="text"
            value={newWord}
            onChange={e => setNewWord(e.target.value)}
            placeholder="New word..."
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-success btn-sm">+ Add Word</button>
        </form>
      )}

      {/* Words list */}
      {!selectedCategoryId ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
          {categories.length === 0 ? 'No draw categories found. Create one to get started.' : 'Select a category to manage its words.'}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {words.length === 0 && (
              <div style={{ color: 'var(--text-muted)', padding: '1rem' }}>No words in this category yet.</div>
            )}
            {words.map(w => (
              <div
                key={w.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '999px',
                  padding: '0.35rem 0.5rem 0.35rem 1rem',
                  fontSize: '0.9rem'
                }}
              >
                <span>{w.word}</span>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteWord(w.id)}
                  style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem', borderRadius: '999px' }}
                  title="Delete word"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="text-center mt-4" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {words.length} word{words.length !== 1 ? 's' : ''} in {getCategoryName(parseInt(selectedCategoryId))}
          </div>
        </>
      )}
    </>
  )
}

function WordSplashAdminPanel() {
  const [words, setWords] = useState([])
  const [newWord, setNewWord] = useState('')
  const [bulkWords, setBulkWords] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchWords = () => {
    fetch('/api/admin/word-splash-words')
      .then(r => r.json())
      .then(setWords)
      .catch(() => {})
  }

  useEffect(() => {
    fetchWords()
  }, [])

  const handleAddWord = async (e) => {
    e.preventDefault()
    if (!newWord.trim()) return
    setError('')
    setSuccess('')
    try {
      const r = await fetch('/api/admin/word-splash-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: newWord.trim() })
      })
      if (!r.ok) {
        const data = await r.json()
        throw new Error(data.error || 'Failed')
      }
      setNewWord('')
      fetchWords()
    } catch (err) {
      setError(err.message || 'Failed to add word.')
    }
  }

  const handleBulkAddWords = async (e) => {
    e.preventDefault()
    if (!bulkWords.trim()) return
    setError('')
    setSuccess('')
    const wordList = bulkWords.split(/[\n,]/).map(w => w.trim()).filter(Boolean)
    if (wordList.length === 0) return
    try {
      const r = await fetch('/api/admin/word-splash-words/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: wordList })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Import failed')
      setSuccess(`Added ${data.imported} word${data.imported !== 1 ? 's' : ''}!`)
      setBulkWords('')
      setShowBulk(false)
      fetchWords()
    } catch (err) {
      setError(err.message || 'Failed to add words.')
    }
  }

  const handleDeleteAllWords = async () => {
    if (!window.confirm('Delete ALL Word Splash words? This cannot be undone.')) return
    setError('')
    setSuccess('')
    try {
      const r = await fetch('/api/admin/word-splash-words', { method: 'DELETE' })
      if (!r.ok) throw new Error('Delete failed')
      const data = await r.json()
      setSuccess(`Deleted ${data.deleted} word${data.deleted !== 1 ? 's' : ''}.`)
      fetchWords()
    } catch {
      setError('Failed to delete words.')
    }
  }

  const handleDeleteWord = async (id) => {
    setError('')
    setSuccess('')
    try {
      const r = await fetch(`/api/admin/word-splash-words/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Delete failed')
      fetchWords()
    } catch {
      setError('Failed to delete word.')
    }
  }

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
        These are the long "base words" used in Word Splash mode. A random one is picked each game,
        and players try to make smaller words out of its letters. Submitted words are only counted
        if they appear in the built-in English dictionary.
      </p>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-end' }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: 0, whiteSpace: 'nowrap' }}
          onClick={() => setShowBulk(!showBulk)}
        >
          📥 Bulk Add Words
        </button>

        <button
          className="btn btn-danger btn-sm"
          style={{ marginBottom: 0, whiteSpace: 'nowrap' }}
          onClick={handleDeleteAllWords}
        >
          🗑 Delete All Words
        </button>
      </div>

      {/* Bulk add words */}
      {showBulk && (
        <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>📥 Bulk Add Words</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Enter one word per line (or comma-separated). Use longer words (8+ letters) for better gameplay.
          </p>
          <form onSubmit={handleBulkAddWords}>
            <div className="form-group">
              <textarea
                value={bulkWords}
                onChange={e => setBulkWords(e.target.value)}
                placeholder={'COMPUTATION\nBASKETBALL\nFIREPLACE\n...'}
                rows={6}
              />
            </div>
            <div className="btn-group">
              <button type="submit" className="btn btn-primary">Add Words</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowBulk(false); setBulkWords('') }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Add single word */}
      <form onSubmit={handleAddWord} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <input
          type="text"
          value={newWord}
          onChange={e => setNewWord(e.target.value)}
          placeholder="New base word..."
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-success btn-sm">+ Add Word</button>
      </form>

      {/* Words list */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {words.length === 0 && (
          <div style={{ color: 'var(--text-muted)', padding: '1rem' }}>No words yet.</div>
        )}
        {words.map(w => (
          <div
            key={w.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '999px',
              padding: '0.35rem 0.5rem 0.35rem 1rem',
              fontSize: '0.9rem'
            }}
          >
            <span>{w.word}</span>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => handleDeleteWord(w.id)}
              style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem', borderRadius: '999px' }}
              title="Delete word"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="text-center mt-4" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        {words.length} word{words.length !== 1 ? 's' : ''}
      </div>
    </>
  )
}

export default Admin
