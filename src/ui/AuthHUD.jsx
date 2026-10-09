import { useBloxity } from '../bloxity/BloxityContext'

/**
 * Who you are, top-right: a picture and a name in one small pill.
 *
 * Shaped after the portal's own player chip - avatar tucked inside the left end of
 * a rounded pill, name beside it, nothing else. No "signed in" line and no log-out
 * control: signing out belongs to the Bloxity portal rather than to a button a
 * player can knock in the middle of a run.
 *
 * Signed out the same pill becomes the button that opens the login, so the corner
 * keeps one shape in one place either way.
 *
 * Uses the `getUser() || getGuest()` pattern (surfaced as `identity` on the context)
 * so there is a name and picture to show even before the player logs in.
 */
export function AuthHUD() {
  const { identity, isLoggedIn, login, status, error } = useBloxity()

  const name = identity?.displayName || identity?.username || 'Guest'
  const pfp = identity?.pfp
  const connecting = status !== 'ready'

  /** The pill itself: dark, rounded all the way, avatar flush into the left end. */
  const pill = 'flex items-center gap-2 rounded-full bg-black/65 py-1 pl-1 pr-4 ring-1 ring-white/15 backdrop-blur'

  const avatar = pfp ? (
    <img src={pfp} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-white/25" />
  ) : (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white ring-2 ring-white/25">
      {name.charAt(0).toUpperCase()}
    </div>
  )

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end p-4">
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        {isLoggedIn ? (
          <div className={pill}>
            {avatar}
            <span className="text-sm font-semibold text-white">{name}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={login}
            disabled={connecting}
            className={`${pill} transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {avatar}
            <span className="text-sm font-semibold text-white">
              {connecting ? 'Connecting…' : 'Log in with Bloxity'}
            </span>
          </button>
        )}

        {status === 'error' && (
          <div className="max-w-xs rounded-lg bg-red-600/80 px-3 py-2 text-xs text-white">
            Bloxity SDK failed to load. {error?.message}
          </div>
        )}
      </div>
    </div>
  )
}

export default AuthHUD
