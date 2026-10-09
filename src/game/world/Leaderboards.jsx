import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

import { useBloxityStore } from '../../bloxity/store'
import { FONT_WEIGHT, GAME_FONT } from '../font'
import { formatNumber } from '../format'
import { useGame } from '../gameStore'
import { useLeaderboard, watchLeaderboard } from '../leaderboard'

/** Each board's canvas, in pixels; its plane in the world keeps the same shape. */
const W = 512
const H = 900
const ROWS = 10

/** The three boards, left to right as you face them. */
const BOARDS = [
  { key: 'wins', title: 'TOP WINS', icon: '🏆', colors: ['#ffd84a', '#f08c00'], mine: (g) => g.wins },
  { key: 'rebirths', title: 'TOP REBIRTHS', icon: '🔄', colors: ['#c58bff', '#7a3fe4'], mine: (g) => g.rebirths },
  { key: 'fights', title: 'TOP FIGHTERS', icon: '🥊', colors: ['#ff7a6a', '#d02b2b'], mine: (g) => g.ringWins },
]

/** Gold, silver and bronze for the top three; the rest wear the board's colour. */
const MEDALS = ['#ffd23f', '#d8e2ee', '#e09a5a']

const INK = '#1b1b25'
const font = (size) => `${FONT_WEIGHT.heavy} ${size}px ${GAME_FONT}`

/** Text with the game's thick dark outline. */
function outlined(ctx, text, x, y, size, fill, align = 'left') {
  ctx.font = font(size)
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.22
  ctx.strokeStyle = INK
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

/** Cuts `text` down with an ellipsis until it fits in `max` pixels at the current font. */
function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text
  let out = text
  while (out.length > 1 && ctx.measureText(`${out}…`).width > max) out = out.slice(0, -1)
  return `${out}…`
}

/**
 * Draws one board: a coloured header, ten ranked rows, and a footer with your own
 * score, so the board says something even before anyone has a save.
 */
function drawBoard(ctx, board, rows, me, myValue) {
  ctx.clearRect(0, 0, W, H)
  const [light, dark] = board.colors

  // Frame and body.
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.roundRect(0, 0, W, H, 36)
  ctx.fill()
  const body = ctx.createLinearGradient(0, 0, 0, H)
  body.addColorStop(0, '#3a2f63')
  body.addColorStop(1, '#221a40')
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.roundRect(10, 10, W - 20, H - 20, 28)
  ctx.fill()

  // Header ribbon.
  const head = ctx.createLinearGradient(0, 10, 0, 130)
  head.addColorStop(0, light)
  head.addColorStop(1, dark)
  ctx.fillStyle = head
  ctx.beginPath()
  ctx.roundRect(10, 10, W - 20, 120, [28, 28, 0, 0])
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath()
  ctx.roundRect(30, 18, W - 60, 12, 6)
  ctx.fill()
  ctx.font = font(56)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(board.icon, W / 2, 50)
  outlined(ctx, board.title, W / 2, 102, 44, '#ffffff', 'center')

  // Rows.
  const top = 150
  const rowH = 62
  for (let i = 0; i < ROWS; i++) {
    const y = top + i * rowH
    const row = rows[i]
    const isMe = row && me && row.username === me
    ctx.fillStyle = isMe ? 'rgba(124,232,106,0.35)' : i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.09)'
    ctx.beginPath()
    ctx.roundRect(24, y, W - 48, rowH - 8, 14)
    ctx.fill()
    const cy = y + (rowH - 8) / 2

    // Rank badge.
    ctx.fillStyle = MEDALS[i] ?? dark
    ctx.beginPath()
    ctx.arc(62, cy, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = INK
    ctx.stroke()
    outlined(ctx, String(i + 1), 62, cy + 1, 28, '#ffffff', 'center')

    if (!row) {
      outlined(ctx, '---', 100, cy, 30, 'rgba(255,255,255,0.35)')
      continue
    }
    const value = formatNumber(row.value)
    ctx.font = font(32)
    const valueW = ctx.measureText(value).width
    outlined(ctx, value, W - 40, cy, 32, light, 'right')
    ctx.font = font(30)
    outlined(ctx, fit(ctx, row.username, W - 40 - valueW - 24 - 100), 100, cy, 30, isMe ? '#b8ffaa' : '#ffffff')
  }

  // Your own score.
  const fy = H - 92
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.roundRect(24, fy, W - 48, 66, 16)
  ctx.fill()
  const rank = me ? rows.findIndex((row) => row.username === me) : -1
  outlined(ctx, rank >= 0 ? `YOU  #${rank + 1}` : 'YOU', 44, fy + 33, 30, '#b8ffaa')
  outlined(ctx, formatNumber(Math.max(0, myValue)), W - 44, fy + 33, 34, light, 'right')
}

/** A board-sized canvas and its texture; `draw(fn)` repaints it with `fn(ctx)`. */
function boardSurface() {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return {
    texture,
    draw(paint) {
      paint(ctx)
      texture.needsUpdate = true
    },
  }
}

/** One board's texture, redrawn whenever its rows, your name or your score change. */
function Board({ board, position, size, rotationY }) {
  const rows = useLeaderboard((s) => s[board.key])
  const me = useBloxityStore((s) => s.user?.username ?? null)
  const myValue = useGame(board.mine)

  const surface = useMemo(() => boardSurface(), [])
  useEffect(() => () => surface.texture.dispose(), [surface])

  useEffect(() => {
    const draw = () => surface.draw((ctx) => drawBoard(ctx, board, rows, me, myValue))
    draw()
    // The font may still be on its way; draw again once it is in.
    document.fonts?.ready.then(draw)
  }, [surface, board, rows, me, myValue])

  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={surface.texture} transparent toneMapped={false} />
    </mesh>
  )
}

/**
 * The leaderboards in the spawn plaza: Wins, Rebirths and fights won, the
 * top ten signed-in players on each (see game/leaderboard.js), and your own score
 * along the bottom.
 *
 * @param {{ center: number[], rotationY: number, width: number, height: number, gap: number }} props
 *   where the middle board's face is, which way they all face, and each board's size
 */
export function Leaderboards({ center, rotationY, width, height, gap }) {
  useEffect(() => watchLeaderboard(), [])
  // Facing back down the lobby (rotationY = PI), "left to right" runs towards -x.
  const step = (width + gap) * (Math.cos(rotationY) < 0 ? -1 : 1)
  return BOARDS.map((board, i) => (
    <Board
      key={board.key}
      board={board}
      position={[center[0] + (i - 1) * step, center[1], center[2]]}
      size={[width, height]}
      rotationY={rotationY}
    />
  ))
}

export default Leaderboards
