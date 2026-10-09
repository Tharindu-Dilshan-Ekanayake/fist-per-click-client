import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'

import { useGame } from '../gameStore'
import { createDynamicLabel } from './textures'
import { GATE_Z } from './themes'

const SIZE = [13, 3]
const POSITION = [0, 12, GATE_Z + 0.12]
const STYLE = { fill: ['#fff6a8', '#ffc21a'], bg: '#15151c', border: '#ffc21a' }
const COUNTDOWN_FILL = '#ffb347'

/**
 * The "STAGE 1" sign over the lobby gate. Drawn on a live canvas (the map's other
 * signs are static, cached textures) so it can also show the walls-rebuild
 * countdown once you're back in the lobby with broken walls behind you — right on
 * this same board, rather than a separate readout floating elsewhere.
 */
export function GateSign() {
  const label = useMemo(() => {
    const made = createDynamicLabel({ aspect: SIZE[0] / SIZE[1], width: 1024 })
    made.draw({ lines: ['STAGE 1'], ...STYLE })
    return made
  }, [])
  useEffect(() => () => label.texture.dispose(), [label])

  // Redraws only when the shown second actually changes (or the countdown starts
  // / ends), not every frame.
  const shown = useRef(null)

  useFrame(() => {
    const resetAt = useGame.getState().wallsResetAt
    const left = resetAt === null ? null : Math.max(0, Math.ceil(resetAt - performance.now() / 1000))
    if (left === shown.current) return
    shown.current = left
    label.draw({
      lines:
        left === null
          ? ['STAGE 1']
          : [
              { text: 'STAGE 1', scale: 1.2 },
              { text: `Walls rebuild in ${left}s`, scale: 0.6, fill: COUNTDOWN_FILL },
            ],
      ...STYLE,
    })
  })

  return (
    <mesh position={POSITION}>
      <planeGeometry args={SIZE} />
      <meshBasicMaterial map={label.texture} transparent toneMapped={false} />
    </mesh>
  )
}

export default GateSign
