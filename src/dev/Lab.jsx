import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'

import GloveModel from '../game/GloveModel'
import { GLOVES } from '../game/gloves'
import { PETS } from '../game/pets'
import { PetModel } from '../game/world/PetModel'
import { Label } from '../game/world/Effects'

/**
 * Development only (`?lab=gloves` or `?lab=pets`): every glove design or every pet in
 * a row on a plain floor, with a fixed camera, for checking how they look without
 * walking round the lobby. `&angle=` turns the camera round them (radians).
 */
const params = new URLSearchParams(location.search)
const kind = params.get('lab')
const angle = Number(params.get('angle') ?? 0.5)
const radius = Number(params.get('r') ?? 0)

function Gloves() {
  // One of each design, in ladder order.
  const seen = new Set()
  const picks = GLOVES.filter((g) => (seen.has(g.design) ? false : seen.add(g.design)))
  return picks.map((glove, i) => {
    const x = (i % 6) * 1.6 - 4
    const z = Math.floor(i / 6) * -1.8
    return (
      <group key={glove.id} position={[x, 1, z]}>
        <group position={[-0.32, 0, 0]} rotation={[0, 0, Math.PI]}>
          <GloveModel glove={glove} side={1} />
        </group>
        <group position={[0.32, 0, 0]} rotation={[0, 0, Math.PI]}>
          <GloveModel glove={glove} side={-1} />
        </group>
        <Label lines={[glove.design]} position={[0, -0.25, 0.5]} size={[1.4, 0.3]} style={{ width: 256 }} />
      </group>
    )
  })
}

function Pets() {
  return PETS.map((pet, i) => {
    const x = (i % 6) * 2 - 5
    const z = Math.floor(i / 6) * -2.4
    return (
      <group key={pet.id} position={[x, 0, z]}>
        <PetModel pet={pet} />
        <Label lines={[pet.name]} position={[0, -0.05, 0.9]} size={[1.6, 0.35]} style={{ width: 256 }} />
      </group>
    )
  })
}

export default function Lab() {
  const r = radius || (kind === 'pets' ? 11 : 8)
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#9fc6e8' }}>
      <Canvas shadows camera={{ position: [Math.sin(angle) * r, r * 0.45, Math.cos(angle) * r], fov: 45 }}>
        <color attach="background" args={['#bfe4ff']} />
        <hemisphereLight args={['#d6ecff', '#6b8f5a', 0.5]} />
        <directionalLight position={[6, 10, 6]} intensity={1.4} castShadow />
        <Environment resolution={64} frames={1} environmentIntensity={0.2}>
          <Lightformer form="rect" intensity={1.4} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
        </Environment>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#d8dce8" />
        </mesh>
        {kind === 'pets' ? <Pets /> : <Gloves />}
        <OrbitControls target={[0, kind === 'pets' ? 0.4 : 0.9, -1]} />
      </Canvas>
    </div>
  )
}
