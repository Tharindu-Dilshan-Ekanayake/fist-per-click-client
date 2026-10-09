import { create } from 'zustand'

import { BACKEND_URL } from '../net/hosting'

/** How often the boards in the lobby ask the server again. */
const REFRESH_MS = 60 * 1000

/**
 * The lobby's leaderboards, as the server last sent them (GET /api/leaderboard):
 * the top ten signed-in players by Wins, by Rebirths and by bosses beaten, each a
 * list of `{ username, value }`. Empty until the first answer, and left as they
 * were if a refresh fails - a stale board beats a blank one.
 */
export const useLeaderboard = create(() => ({
  wins: [],
  rebirths: [],
  bosses: [],
  loaded: false,
}))

async function refresh() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/leaderboard`)
    if (!res.ok) return
    const body = await res.json()
    useLeaderboard.setState({
      wins: body.wins ?? [],
      rebirths: body.rebirths ?? [],
      bosses: body.bosses ?? [],
      loaded: true,
    })
  } catch {
    // Offline, or no server in this build: keep whatever is showing.
  }
}

let users = 0
let timer = null

/**
 * Keeps the boards fresh while something is showing them. Returns the matching stop;
 * made for a useEffect.
 */
export function watchLeaderboard() {
  if (users++ === 0) {
    refresh()
    timer = setInterval(refresh, REFRESH_MS)
  }
  return () => {
    if (--users === 0) {
      clearInterval(timer)
      timer = null
    }
  }
}
