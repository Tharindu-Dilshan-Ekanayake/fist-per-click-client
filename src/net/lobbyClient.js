import { Client } from '@colyseus/sdk'
import { create } from 'zustand'

import { waitForSDK } from '../bloxity/sdk'
import { dropFx } from '../game/fightFx'
import { clearRings, markRingStart, ringEvents, setRingHp, setRings } from '../game/ringState'
import { hosting, LOCAL_SERVER_URL, matchmakerOptions, viaMatchmaker } from './hosting'
import { addSnapshot, newTrack } from './snapshots'

/**
 * Connection to the lobby server, over Colyseus (see the server's lobbyRoom.js for
 * the protocol - the message types match one-for-one, 'hello' aside: joining the
 * room already carries the profile that used to be sent as a first message).
 * Joining happens automatically: the server puts us in a lobby with room. If the
 * server can't be reached the game still plays, solo, and keeps retrying.
 *
 * On Boxity hosting every connect goes through the matchmaker: the SDK asks
 * play.bloxity.io for a seat, gets back a relay endpoint pinned to one pod, and a
 * brand new Client is built on it. Never a Client on <id>.host.bloxity.io - that is
 * one fixed pod, and Boxity would never see the players or start a second one. A
 * room that drops out from under us (a deploy draining its pod) is just another
 * reconnect: resolve again, land on the fresh pod.
 */

/** Waits before each reconnect attempt; the last repeats. A cold start can take ~45 s. */
const RETRY_MS = [1000, 2000, 5000, 10000]

/**
 * status: 'connecting' | 'online' | 'offline'
 * lobby: { id, name, max } while online
 * players: the *other* players in our lobby, by id: { name, avatar, glove, pet, trainer, footprints }
 */
export const useLobby = create(() => ({ status: 'connecting', lobby: null, selfId: null, players: {} }))

/**
 * Every other player's movement track, by id (see snapshots.js), for smooth
 * playback in RemotePlayers. Updated 20 times a second, so it's kept out of React
 * state and read from frame loops.
 */
export const remoteStates = new Map()

/**
 * Where each other player is being drawn this frame (RemotePlayers writes it), by id:
 * `{ x, y, z }`. The boxing rings read it to face an opponent and to put the punch
 * bursts on them.
 */
export const remotePositions = new Map()

/** Only used without the matchmaker (local development): one fixed server. */
const localClient = viaMatchmaker ? null : new Client(LOCAL_SERVER_URL.replace(/^http/, 'ws'))
let room = null
let profile = { name: 'Player', avatar: null, glove: null, pet: null, trainer: null, footprints: null, aura: null, level: 1 }
let stopped = true
let retries = 0
let retryTimer = null
/** Bumped on every connect/disconnect, so a join that resolves late (superseded
 *  by a newer connect, or a disconnect while it was in flight) knows to back out
 *  instead of resurrecting a connection nobody wants any more. */
let connectId = 0

function profileOf(player, previous) {
  // Keep the same avatar object when it hasn't changed, so the model isn't rebuilt
  // just because the player switched gloves.
  const avatar =
    previous && JSON.stringify(previous.avatar) === JSON.stringify(player.avatar) ? previous.avatar : player.avatar
  return {
    name: player.name,
    avatar,
    glove: player.glove,
    pet: player.pet,
    trainer: player.trainer,
    footprints: player.footprints ?? null,
    aura: player.aura ?? null,
    level: player.level ?? 1,
  }
}

function retry() {
  if (stopped) return
  retryTimer = setTimeout(open, RETRY_MS[Math.min(retries++, RETRY_MS.length - 1)])
}

/** Wires up a just-joined room's message handlers and disconnect/retry behaviour. */
function attach(joined) {
  joined.onMessage('welcome', (message) => {
    remoteStates.clear()
    const next = {}
    for (const player of message.players) {
      next[player.id] = profileOf(player)
      remoteStates.set(player.id, newTrack(player.p, player.sw, performance.now()))
    }
    useLobby.setState({ status: 'online', lobby: message.lobby, selfId: message.id, players: next })
    setRings(message.rings)
  })
  joined.onMessage('join', (message) => {
    remoteStates.set(message.player.id, newTrack(message.player.p, message.player.sw, performance.now()))
    useLobby.setState({ players: { ...useLobby.getState().players, [message.player.id]: profileOf(message.player) } })
  })
  joined.onMessage('leave', (message) => {
    remoteStates.delete(message.id)
    remotePositions.delete(message.id)
    dropFx(message.id)
    const next = { ...useLobby.getState().players }
    delete next[message.id]
    useLobby.setState({ players: next })
  })
  joined.onMessage('profile', (message) => {
    const { players } = useLobby.getState()
    if (players[message.id]) {
      useLobby.setState({ players: { ...players, [message.id]: profileOf(message, players[message.id]) } })
    }
  })
  joined.onMessage('states', (message) => {
    const { selfId } = useLobby.getState()
    for (const [id, x, y, z, sw, ts] of message.s) {
      if (id === selfId) continue
      const state = remoteStates.get(id)
      if (state) addSnapshot(state, [x, y, z], sw, ts, performance.now())
    }
  })
  joined.onMessage('rings', (message) => setRings(message.rings))
  joined.onMessage('ringHit', (message) => {
    setRingHp(message.r, message.hp)
    ringEvents.hit(message)
  })
  joined.onMessage('ringStart', (message) => {
    // The fighters are in from this moment, before the next snapshot says so: the
    // teleport into the ring must not meet a ring that still thinks they are outside.
    markRingStart(message.r, message.f, message.mh)
    ringEvents.start(message)
  })
  joined.onMessage('ringCancel', (message) => ringEvents.cancel(message))
  joined.onMessage('ringKO', (message) => ringEvents.ko(message))
  joined.onMessage('ringDeny', (message) => ringEvents.deny(message))
  joined.onMessage('ringMiss', (message) => ringEvents.miss(message))
  joined.onLeave(() => {
    if (room !== joined) return
    room = null
    remoteStates.clear()
    remotePositions.clear()
    clearRings()
    useLobby.setState({ status: 'offline', lobby: null, selfId: null, players: {} })
    retry()
  })
}

/**
 * A Client to join through. With the matchmaker, a fresh one on every call: each
 * endpoint is pinned to the pod the matchmaker picked, so reusing an earlier one
 * would send us back to a pod that may be full or gone.
 */
async function clientForJoin() {
  if (!viaMatchmaker) return localClient
  const sdk = await waitForSDK()
  const { endpoint } = await sdk.net.resolveEndpoint(hosting.id, matchmakerOptions)
  return new Client(endpoint)
}

async function open() {
  const id = ++connectId
  useLobby.setState({ status: 'connecting' })
  let joined
  try {
    const client = await clientForJoin()
    if (id !== connectId || stopped) return
    joined = await client.joinOrCreate('lobby', { ...profile })
  } catch (err) {
    console.warn('[lobby] connect failed', err)
    retry()
    return
  }
  if (id !== connectId || stopped) {
    // A newer connect() (or a disconnectLobby()) beat us here - don't leave two
    // lobby memberships alive for one player.
    joined.leave()
    return
  }
  retries = 0
  room = joined
  attach(joined)
}

/** Connects (and keeps reconnecting) using the latest profile. */
export function connectLobby() {
  if (!stopped) return
  stopped = false
  open()
}

export function disconnectLobby() {
  stopped = true
  connectId++
  clearTimeout(retryTimer)
  const joined = room
  room = null
  joined?.leave()
  remoteStates.clear()
  remotePositions.clear()
  clearRings()
  useLobby.setState({ status: 'offline', lobby: null, selfId: null, players: {} })
}

/** Our name / avatar / gloves. Remembered for (re)connects and sent now if online. */
export function updateProfile(next) {
  profile = next
  room?.send('profile', next)
}

/**
 * Our position (the body's centre), how many punches we've thrown, and the time (ms,
 * our clock) that position is for.
 */
export function sendState(p, sw, ts = performance.now()) {
  room?.send('state', { p, sw, ts: Math.round(ts) })
}

/** Stepped onto ring `r`'s pad `slot` (0 red, 1 blue), with this much Strength. */
export const sendPadEnter = (r, slot, power) => room?.send('padEnter', { r, slot, power })
/** Stepped off it. */
export const sendPadLeave = (r, slot) => room?.send('padLeave', { r, slot })
/** Threw a punch in it. */
export const sendRingPunch = (r, power) => room?.send('ringPunch', { r, power })
/** Whether there is a server to talk to right now. */
export const lobbyOnline = () => room !== null
