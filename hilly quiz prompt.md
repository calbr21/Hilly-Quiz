# Hilly Quiz — Claude Code Build Prompt

## Project overview
Build a full-stack, real-time family quiz game called **Hilly Quiz**. It works like Kahoot — a host runs the game on a main screen (TV/laptop), players join on their phones using a PIN, and answer questions in real time. Scores are saved to a persistent family leaderboard between sessions.

## Tech stack
- **Backend:** Node.js + Express + Socket.io
- **Frontend:** React (Vite)
- **Database:** SQLite (via better-sqlite3) — simple file-based DB, no setup needed for local dev
- **Monorepo structure:** single repo, `/server` and `/client` folders

## Folder structure to create
```
hilly-quiz/
├── server/
│   ├── index.js          # Express + Socket.io server
│   ├── db.js             # SQLite setup and queries
│   ├── routes/
│   │   ├── admin.js      # Question/category management
│   │   └── leaderboard.js
│   └── game/
│       └── gameManager.js  # Game session logic
├── client/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx         # Landing — join with PIN or go to host
│   │   │   ├── Join.jsx         # Player: enter PIN + pick/create nickname
│   │   │   ├── PlayerGame.jsx   # Player: answer questions on phone
│   │   │   ├── HostLobby.jsx    # Host: waiting room, shows PIN + joined players
│   │   │   ├── HostGame.jsx     # Host: controls game, shows question on big screen
│   │   │   ├── HostResults.jsx  # Host: end of game scores
│   │   │   ├── Leaderboard.jsx  # All-time family leaderboard
│   │   │   └── Admin.jsx        # Add/edit questions and categories
│   │   └── socket.js    # Socket.io client singleton
│   ├── index.html
│   └── vite.config.js
├── package.json          # Root: scripts to run both server + client
└── .env.example
```

## Database schema (SQLite)

```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  is_custom INTEGER DEFAULT 0
);

CREATE TABLE questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES categories(id),
  question_text TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('multiple_choice', 'true_false')),
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  correct_answer TEXT NOT NULL,  -- 'A', 'B', 'C', 'D', 'True', or 'False'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE nicknames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname_id INTEGER REFERENCES nicknames(id),
  total_points INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pin TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  status TEXT DEFAULT 'lobby',  -- lobby | active | finished
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Seed the database with these 10 default categories on first run:
General Knowledge, History, Science & Nature, Geography, Sport, Music, Films & TV, Food & Drink, Art & Literature, Technology

## Game flow (Socket.io events)

### Host creates a game
1. Host visits `/host` → picks a category → clicks "Create game"
2. Server generates a random 4-digit PIN, creates a game session in DB
3. Host is redirected to `/host/lobby` — sees the PIN large on screen and a live list of players as they join

### Players join
1. Player visits the site on their phone → enters PIN + picks or creates a nickname
2. Server checks PIN exists and game is in lobby state
3. If nickname is new: create it in `nicknames` table
4. Player joins the Socket.io room for that PIN
5. Host lobby updates in real time showing the new player

### Game runs
1. Host clicks "Start game" — server begins sending questions one at a time
2. Host screen shows the question + all 4 options (or True/False)
3. Player phones show just the answer buttons (large, easy to tap)
4. Players tap an answer — server records it, player sees "Waiting for others..."
5. After all players answer OR 20 seconds — host clicks "Next" to reveal correct answer and scores
6. Repeat for all questions in the category (or a set number the host picks)

### End of game
1. Server calculates final scores, updates `leaderboard` table (add points to each nickname's total)
2. Host screen shows final podium (top 3 with names + scores)
3. "View full leaderboard" button shows all-time family leaderboard

## Socket.io events to implement

**Client → Server:**
- `host:create` `{ categoryId }` → responds with `{ pin, gameId }`
- `player:join` `{ pin, nickname }` → responds with `{ success, error? }`
- `player:answer` `{ gameId, questionId, answer }` 
- `host:next_question` `{ gameId }`
- `host:start_game` `{ gameId }`
- `host:end_game` `{ gameId }`

**Server → Client:**
- `lobby:player_joined` `{ players: [] }` → broadcast to host
- `game:question` `{ questionId, text, type, options, timeLimit }` → all players + host
- `game:answer_received` `{ answeredCount, totalPlayers }` → host only
- `game:reveal` `{ correctAnswer, scores: [] }` → all
- `game:end` `{ finalScores: [], leaderboard: [] }` → all

## Key behaviours

**Nickname system:**
- On the join page, show a text input for a new nickname AND a list of existing nicknames stored in localStorage as "quick pick" buttons
- When an existing nickname is picked, look it up in the DB so their leaderboard history carries over
- Nicknames are globally unique in the DB — if two people try the same name in the same game, second one gets an error

**Leaderboard:**
- Points per correct answer: 100 pts flat
- After each game, `total_points` and `games_played` are updated for each nickname in the DB
- Leaderboard page at `/leaderboard` shows all nicknames ranked by total_points, with games played shown

**Admin panel** (`/admin`):
- Simple page (no login needed for local dev) to add/edit/delete questions
- Form fields: category (dropdown), question text, type (multiple choice or true/false), options A-D (hide C and D if true/false), correct answer
- Show existing questions in a table, filterable by category

**Host controls:**
- Host picks how many questions to use (default: all in category, or a number picker 5/10/15/20)
- During the game, host screen always shows: current question, a live count of how many have answered, and a "Next" button
- Host can see the correct answer immediately; players cannot until host clicks Next

## Styles
- Keep it clean and simple — use plain CSS or Tailwind (whichever is faster to set up)
- Player phone view: answer buttons should be LARGE and full-width, easy to tap on mobile
- Host/main screen: large text, readable from across a room
- Use these 4 colours for the answer options (A/B/C/D): purple, teal, coral/orange, amber

## Local dev setup
- Server runs on port 3000
- Vite dev server runs on port 5173 with a proxy to port 3000
- Single `npm run dev` from root should start both (use concurrently)
- Database file stored at `./server/hilly-quiz.db`

## package.json scripts (root)
```json
{
  "scripts": {
    "dev": "concurrently \"npm run server\" \"npm run client\"",
    "server": "node --watch server/index.js",
    "client": "cd client && npm run dev"
  }
}
```

## What to build first (in order)
1. Server setup: Express + Socket.io + SQLite DB with schema + seed data
2. Basic client: Vite + React router with page stubs
3. Join flow: PIN entry + nickname pick/create
4. Host lobby: create game, show PIN, live player list
5. Game loop: questions → answers → reveal → next
6. End of game: scores saved, leaderboard updated
7. Leaderboard page
8. Admin panel for adding questions

## Notes
- Use `better-sqlite3` (synchronous, no async complexity) for all DB queries
- Socket.io rooms: use the PIN as the room name
- Store `gameId` and `nickname` in React state / localStorage on the client so players can rejoin if they accidentally refresh
- No authentication needed — this is a local family game
