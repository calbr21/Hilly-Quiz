import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Join from './pages/Join.jsx'
import PlayerGame from './pages/PlayerGame.jsx'
import HostLobby from './pages/HostLobby.jsx'
import HostGame from './pages/HostGame.jsx'
import HostResults from './pages/HostResults.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import Admin from './pages/Admin.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/join" element={<Join />} />
      <Route path="/play" element={<PlayerGame />} />
      <Route path="/host" element={<HostLobby />} />
      <Route path="/host/game" element={<HostGame />} />
      <Route path="/host/results" element={<HostResults />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  )
}

export default App
