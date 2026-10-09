import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

import GloveModel from '../GloveModel'
import { GATE_Z, OPEN_HALF } from './themes'

/** Red corner, blue corner: the pair on top of the gate's pillars. Not for sale. */
const RED = { id: 'gate-red', name: 'Red Corner', design: 'pro', main: '#e8352d', cuff: '#ffffff', trim: '#ffd23f', size: 1, glow: 0.3 }
const BLUE = { id: 'gate-blue', name: 'Blue Corner', design: 'pro', main: '#2f6ee8', cuff: '#ffffff', trim: '#ffd23f', size: 1, glow: 0.3 }
/** Where they stand: on the pillar caps either side of the door (see layout.js). */
const X = OPEN_HALF + 2.8
const Y = 14.05
const Z = GATE_Z + 0.7
const SCALE = 4.2

/**
 * A giant glove on top of each of the arena gate's pillars, knuckles to the sky and
 * leaning in towards the door, bobbing as if they are about to touch gloves.
 */
export function GateGloves() {
  const left = useRef(null)
  const right = useRef(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const bob = Math.sin(t * 1.8) * 0.12
    if (left.current) {
      left.current.position.y = Y + bob
      left.current.rotation.z = Math.PI - 0.32 + Math.sin(t * 1.8) * 0.05
    }
    if (right.current) {
      right.current.position.y = Y - bob
      right.current.rotation.z = Math.PI + 0.32 - Math.sin(t * 1.8) * 0.05
    }
  })
  return (
    <>
      <group ref={left} position={[-X, Y, Z]} rotation={[0, 0, Math.PI - 0.32]} scale={SCALE}>
        <GloveModel glove={RED} side={1} minGlow={0.3} sparkles={false} />
      </group>
      <group ref={right} position={[X, Y, Z]} rotation={[0, 0, Math.PI + 0.32]} scale={SCALE}>
        <GloveModel glove={BLUE} side={-1} minGlow={0.3} sparkles={false} />
      </group>
    </>
  )
}

export default GateGloves
