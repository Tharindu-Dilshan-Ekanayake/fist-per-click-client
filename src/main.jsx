import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.jsx'
import BloxityProvider from './bloxity/BloxityProvider.jsx'
import { loadGameFont } from './game/font'
import './index.css'

/**
 * Wait for the lettering, then start the game.
 *
 * Not a nicety. Every sign in the world - the wall numbers, the shop prices, the
 * damage popups - is text drawn onto a canvas, and those canvases are cached for the
 * life of the page (see game/world/textures.js). Canvas does not wait for a web font
 * and does not report that it is missing: it draws in the fallback and carries on,
 * so a font that arrives one frame late does not look wrong for one frame, it is
 * baked into every sign until the player reloads.
 *
 * `loadGameFont` resolves either way and gives up after a few seconds, so a font
 * that will not load costs the game its lettering and nothing else.
 */
loadGameFont().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      {/* Slug comes from VITE_GAME_SLUG in client/.env — see .env.example. */}
      <BloxityProvider gameSlug={import.meta.env.VITE_GAME_SLUG}>
        <App />
      </BloxityProvider>
    </StrictMode>,
  )
})
