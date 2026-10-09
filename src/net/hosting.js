/**
 * Where this build is running, and so where its server is.
 *
 * Boxity hosting gives every game two front ends and two back ends:
 *
 *   front end   https://<id>.play.bloxity.io        https://<id>.dev.play.bloxity.io
 *   back end    https://<id>.host.bloxity.io        https://<id>.dev.host.bloxity.io
 *
 * and a page on one of those front ends is all the information needed: the hostname
 * says the id and the channel. Anywhere else - your own domain, a Netlify preview,
 * `npm run dev` - the id comes from VITE_HOSTING_ID and the channel from VITE_CHANNEL.
 *
 * Two different things talk to the server, and they go different ways:
 *
 *   - HTTP (cloud saves) goes straight to the back end address above.
 *   - The multiplayer socket must NEVER go there. It goes through the matchmaker at
 *     play.bloxity.io (see lobbyClient.js), which is what lets Boxity fill one pod,
 *     start another when it's full, and scale to zero when everyone leaves.
 *
 * Local development is the exception to both: with no hosting id, or on localhost
 * with VITE_SERVER_URL set, everything goes to that one local server.
 */

const env = import.meta.env
const BLOXITY_FRONTEND = /^([a-z0-9-]+)\.(dev\.)?play\.bloxity\.io$/i

function readHosting() {
  const host = typeof location === 'undefined' ? '' : location.hostname
  const match = host.match(BLOXITY_FRONTEND)
  if (match) return { id: match[1].toLowerCase(), channel: match[2] ? 'dev' : 'prod', onBloxity: true }
  const local = /^(localhost|127\.|192\.168\.|10\.|\[::1\])/.test(host)
  return {
    id: env.VITE_HOSTING_ID || null,
    channel: env.VITE_CHANNEL === 'dev' ? 'dev' : 'prod',
    onBloxity: false,
    local,
  }
}

export const hosting = readHosting()

/**
 * True when the socket should go through the Boxity matchmaker: always on a Boxity
 * front end, and from anywhere else that knows its hosting id - unless this is a
 * local dev server pointed at a local game server.
 */
export const viaMatchmaker = Boolean(
  hosting.onBloxity || (hosting.id && !(hosting.local && env.VITE_SERVER_URL)),
)

/** The local (or self-hosted) game server, for development. */
export const LOCAL_SERVER_URL = (env.VITE_SERVER_URL || 'http://localhost:3000').replace(/\/+$/, '')

/** The game server's HTTP address: cloud saves and anything else that isn't the socket. */
export const BACKEND_URL = (() => {
  if (env.VITE_BACKEND_URL) return env.VITE_BACKEND_URL.replace(/\/+$/, '')
  if (viaMatchmaker && hosting.id) {
    return `https://${hosting.id}.${hosting.channel === 'dev' ? 'dev.' : ''}host.bloxity.io`
  }
  return LOCAL_SERVER_URL
})()

/**
 * What to tell the matchmaker about which channel to seat us on. A page on a Boxity
 * front end reaches its own channel by itself; anywhere else reaches prod unless it
 * asks for the dev back end by name.
 */
export const matchmakerOptions = !hosting.onBloxity && hosting.channel === 'dev' ? { version: 'preview' } : {}
