import { useEffect } from 'react'

import { toggleMuted, toggleMusic, useMusic, useSound } from '../game/sound'

/**
 * Speaker button, top right: turns every game sound on or off (M does too). Under
 * it, the music on or off on its own (N). Both remembered.
 */
export function SoundToggle() {
  const muted = useSound((s) => s.muted)
  const music = useMusic((s) => s.on)

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.code !== 'KeyM' && e.code !== 'KeyN') || e.repeat) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')) return
      if (e.code === 'KeyM') toggleMuted()
      else toggleMusic()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
    <button
      type="button"
      onClick={toggleMusic}
      aria-label={music ? 'Turn music off' : 'Turn music on'}
      title="Music (N)"
      className="pointer-events-auto absolute right-4 top-[8.25rem] z-10 flex h-11 w-11 items-center justify-center rounded-xl bg-black/50 text-xl text-white backdrop-blur transition hover:bg-black/60"
      style={{ opacity: music && !muted ? 1 : 0.55 }}
    >
      <span aria-hidden>{music ? '🎵' : '🔇'}</span>
    </button>
    <button
      type="button"
      onClick={toggleMuted}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      title="Sound (M)"
      className="pointer-events-auto absolute right-4 top-20 z-10 flex h-11 w-11 items-center justify-center rounded-xl bg-black/50 text-white backdrop-blur transition hover:bg-black/60"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" />
        {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
      </svg>
    </button>
    </>
  )
}

export default SoundToggle
