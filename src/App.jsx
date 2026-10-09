import { useRef } from 'react'

import GameScene from './game/GameScene'
import AuthHUD from './ui/AuthHUD'
import FpsCounter from './ui/FpsCounter'
import GameHUD from './ui/GameHUD'
import HowToPlay from './ui/HowToPlay'
import LoadingScreen from './ui/LoadingScreen'
import SoundToggle from './ui/SoundToggle'
import TouchControls from './ui/TouchControls'

function App() {
  const playerBodyRef = useRef(null)
  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-slate-900">
      <GameScene bodyRef={playerBodyRef} />
      <AuthHUD />
      {/* The Controls button and its popup live in the same left rail as Pets and
          Rebirth - see ui/Controls.jsx and ui/GameHUD.jsx's WinsCounter. */}
      <GameHUD />
      <TouchControls />
      <SoundToggle />
      <FpsCounter />
      <LoadingScreen />
      <HowToPlay />
    </div>
  )
}

export default App
