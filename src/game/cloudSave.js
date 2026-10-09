import { create } from 'zustand'

import { getSDK, safeCall } from '../bloxity/sdk'
import { useBloxityStore } from '../bloxity/store'
import { BACKEND_URL } from '../net/hosting'
import { DEFAULT_PROGRESS, pickProgress, PROGRESS_KEYS, useGame } from './gameStore'

/**
 * Keeps a signed-in player's progress on the game server, so it is still there next
 * time - on another device, in another browser, after the cache is cleared, weeks
 * later. Guests keep theirs in localStorage only, exactly as before.
 *
 * The server stores it in the game's own MongoDB, keyed by the Bloxity account it
 * verified from the player's token (see server/src/routes.js). It never takes the
 * client's word for who is saving.
 *
 * ── Which copy wins ──────────────────────────────────────────────────────────────
 * Every save the server accepts gets a revision number, and the local copy remembers
 * the revision it last synced (`syncedRev`) and whether it has changed since
 * (`dirty`, per account, in localStorage). On sign-in:
 *
 *   server has nothing     -> adopt what is on screen if it is a guest's run or
 *                             already this account's; otherwise start fresh. Push it.
 *   server is newer        -> the server's copy (played somewhere else since).
 *   local has unsynced     -> the local copy (the tab closed before it could save,
 *   changes, same revision    or the server was briefly unreachable). Push it.
 *   otherwise              -> the server's copy.
 *
 * ── When it saves ──────────────────────────────────────────────────────────────────
 * A few seconds after progress stops changing, at least every MAX_WAIT_MS while it
 * keeps changing (a clicker never stops), and straight away when the tab is hidden.
 * When the page is actually closing it goes as a beacon instead (see `beacon`).
 *
 * Signing out puts the guest back at a fresh start: the account's progress is on the
 * server, and leaving it on screen would hand it to whoever plays next.
 */

const SAVE_DEBOUNCE_MS = 3000
const MAX_WAIT_MS = 15000
const RETRY_MS = [2000, 5000, 10000, 30000]

/** For the HUD: 'guest' | 'loading' | 'saved' | 'saving' | 'offline'. */
export const useCloud = create(() => ({ status: 'guest' }))

const dirtyKey = (userId) => `apc-dirty:${userId}`
const isDirty = (userId) => {
  try {
    return localStorage.getItem(dirtyKey(userId)) === '1'
  } catch {
    return false
  }
}
const setDirty = (userId, dirty) => {
  try {
    if (dirty) localStorage.setItem(dirtyKey(userId), '1')
    else localStorage.removeItem(dirtyKey(userId))
  } catch {
    // Private browsing: worst case a closed tab's last seconds are not recovered.
  }
}

const token = () => {
  const auth = getSDK()?.auth
  return safeCall(auth?.getToken?.bind(auth)) || null
}

async function request(method, body) {
  const auth = token()
  if (!auth) throw new Error('no token')
  const res = await fetch(`${BACKEND_URL}/api/progress`, {
    method,
    headers: { Authorization: `Bearer ${auth}`, ...(body ? { 'Content-Type': 'application/json' } : null) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} /api/progress ${res.status}`)
  return res.json()
}

/** The signed-in account this session is syncing, once its progress has loaded. */
let syncing = null
let saveTimer = null
let firstChangeAt = 0
let saving = false
let loadAttempt = 0

function scheduleSave() {
  if (!syncing) return
  const now = Date.now()
  if (!firstChangeAt) firstChangeAt = now
  clearTimeout(saveTimer)
  const wait = Math.min(SAVE_DEBOUNCE_MS, Math.max(0, firstChangeAt + MAX_WAIT_MS - now))
  saveTimer = setTimeout(() => save(), wait)
}

async function save() {
  clearTimeout(saveTimer)
  const userId = syncing
  if (!userId || !isDirty(userId)) return
  if (saving) {
    scheduleSave()
    return
  }
  saving = true
  firstChangeAt = 0
  useCloud.setState({ status: 'saving' })
  const snapshot = pickProgress(useGame.getState())
  try {
    const { rev } = await request('PUT', { progress: snapshot })
    if (syncing !== userId) return
    useGame.setState({ syncedRev: rev })
    // Only clean if nothing moved while the request was out; otherwise go again.
    const now = pickProgress(useGame.getState())
    if (PROGRESS_KEYS.every((key) => now[key] === snapshot[key])) setDirty(userId, false)
    else scheduleSave()
    useCloud.setState({ status: 'saved' })
  } catch (err) {
    console.warn('[cloud] save failed, will retry', err)
    useCloud.setState({ status: 'offline' })
    if (syncing === userId) saveTimer = setTimeout(() => save(), RETRY_MS[1])
  } finally {
    saving = false
  }
}

async function load(userId) {
  const attempt = ++loadAttempt
  useCloud.setState({ status: 'loading' })
  let server
  try {
    server = await request('GET')
  } catch (err) {
    console.warn('[cloud] load failed, retrying', err)
    useCloud.setState({ status: 'offline' })
    const wait = RETRY_MS[Math.min(attempt - 1, RETRY_MS.length - 1)]
    setTimeout(() => {
      if (useBloxityStore.getState().user?._id === userId && !syncing) load(userId)
    }, wait)
    return
  }
  // Signed out (or in as someone else) while that was in flight.
  if (useBloxityStore.getState().user?._id !== userId) return

  const game = useGame.getState()
  const mine = game.ownerId === userId
  let push = false
  if (!server.progress) {
    // A first sign-in brings the guest's run with it; someone else's never.
    if (game.ownerId === null || mine) useGame.setState({ ownerId: userId, syncedRev: 0 })
    else game.loadProgress(DEFAULT_PROGRESS, { ownerId: userId })
    push = true
  } else if (mine && isDirty(userId) && game.syncedRev >= server.rev) {
    // This browser has changes the server never got, and the server has nothing
    // newer: they win.
    push = true
  } else {
    game.loadProgress(server.progress, { ownerId: userId, syncedRev: server.rev })
  }

  syncing = userId
  setDirty(userId, push)
  useCloud.setState({ status: 'saved' })
  if (push) save()
}


/**
 * The last save, as the page closes.
 *
 * A normal request may not survive the page, and one carrying an Authorization
 * header needs a CORS preflight first, which browsers will not wait for on the way
 * out. A beacon is the one request a closing page is guaranteed to send, and as
 * plain text it needs no preflight - so the token travels in the body instead
 * (see /api/progress/beacon on the server). Nothing comes back: the dirty flag stays
 * set, and the next load sorts out which copy is newer by revision.
 */
function beacon() {
  const auth = token()
  if (!syncing || !isDirty(syncing) || !auth || !navigator.sendBeacon) return
  const body = JSON.stringify({ token: auth, progress: pickProgress(useGame.getState()) })
  navigator.sendBeacon(`${BACKEND_URL}/api/progress/beacon`, new Blob([body], { type: 'text/plain' }))
}

let started = false

/**
 * Starts syncing; call once. Follows the Bloxity user from then on: loads on sign-in,
 * resets on sign-out, and saves in between.
 */
export function startCloudSave() {
  if (started) return
  started = true

  let currentUser = useBloxityStore.getState().user?._id ?? null
  const onUser = (userId) => {
    if (userId === currentUser) return
    const previous = currentUser
    currentUser = userId
    clearTimeout(saveTimer)
    syncing = null
    firstChangeAt = 0
    if (userId) {
      load(userId)
    } else {
      useCloud.setState({ status: 'guest' })
      // Only on a real sign-out, not on the null the SDK reports before its
      // handshake lands: wipe the account's progress off the screen.
      if (previous) useGame.getState().loadProgress(DEFAULT_PROGRESS)
    }
  }
  if (currentUser) load(currentUser)
  useBloxityStore.subscribe((state) => onUser(state.user?._id ?? null))

  // Any change to progress marks it dirty and queues a save.
  useGame.subscribe((state, prev) => {
    if (!syncing || state.ownerId !== syncing) return
    if (PROGRESS_KEYS.every((key) => state[key] === prev[key])) return
    setDirty(syncing, true)
    scheduleSave()
  })

  // Hidden (another tab, the phone locked): the page is still alive, so an ordinary
  // save. Closing: a beacon, the only request sure to leave a dying page.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save()
  })
  window.addEventListener('pagehide', beacon)
}
