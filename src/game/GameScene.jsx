import { Environment, Lightformer } from '@react-three/drei'
import { Canvas, useFrame, useStore, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { useBloxity } from '../bloxity/BloxityContext'
import FollowCamera from './FollowCamera'
import { useGame } from './gameStore'
import { useLoading } from './loadingStore'
import NetSync from './NetSync'
import PetCompanion from './PetCompanion'
import Footprints from './Footprints'
import Player from './Player'
import PunchEffects from './PunchEffects'
import PunchInput from './PunchInput'
import RemotePlayers from './RemotePlayers'
import RingDirector from './RingDirector'
import { qualityOf, useSettings } from './settings'
import { SPACE_SPAWN, SPAWN } from './world/themes'
import { refreshMaterials } from './world/nearField'
import World, { SunLight } from './world/World'

/**
 * Turns the shadow map on and off as the graphics level changes. The Canvas only
 * reads its `shadows` prop when it builds the renderer, so switching levels mid-
 * session has to reach `gl.shadowMap` directly - and every material already in the
 * scene needs a recompile to pick the change up.
 */
function ShadowToggle({ enabled }) {
  // Read through the store rather than useThree's selector: the renderer is being
  // reconfigured here, not rendered from, and hook-returned values are read-only.
  const store = useStore()
  useEffect(() => {
    const { gl, scene } = store.getState()
    if (gl.shadowMap.enabled === enabled) return
    gl.shadowMap.enabled = enabled
    gl.shadowMap.needsUpdate = true
    scene.traverse((o) => {
      if (!o.material) return
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true
    })
  }, [enabled, store])
  return null
}

/**
 * Fires `onFirstFrame` after the renderer has actually drawn once.
 * `loadingEnd()` should mean "the player can see the game", not "React mounted".
 */
function FirstFrameSignal({ onFirstFrame }) {
  const fired = useRef(false)
  useFrame(() => {
    if (fired.current) return
    fired.current = true
    onFirstFrame()
  })
  return null
}

/**
 * Brings the picture back after the GPU drops the WebGL context - a driver reset, or
 * a weak GPU giving up under the load-time shader compile. three.js rebuilds its own
 * state when the context returns, but materials and textures only re-upload when
 * asked, so this asks for all of them.
 */
function ContextRecovery() {
  const store = useStore()
  useEffect(() => {
    const { gl } = store.getState()
    const canvas = gl.domElement
    const onLost = (e) => {
      e.preventDefault()
      console.warn('[render] WebGL context lost - waiting for it to come back')
    }
    const onRestored = () => {
      console.warn('[render] WebGL context restored - re-uploading the scene')
      refreshMaterials(store.getState().scene, { textures: true })
    }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [store])
  return null
}

/** Tells the loading screen the map has been drawn (mounted after World, in its Suspense). */
function WorldReady() {
  useFrame(() => {
    const loading = useLoading.getState()
    if (!loading.world) loading.worldReady()
  })
  return null
}

/**
 * Soft reflections and fill light, built from a few light panels in the scene
 * itself. drei's `preset="city"` downloads an HDR file from an external CDN, and
 * until it arrives (or forever, if that host is slow or blocked) everything in the
 * same Suspense stays invisible.
 */
function LocalEnvironment() {
  return (
    <Environment resolution={64} frames={1} environmentIntensity={0.16}>
      <color attach="background" args={['#9fc6e8']} />
      <Lightformer form="rect" intensity={1.4} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
      <Lightformer
        form="rect"
        intensity={0.6}
        color="#ffe9c4"
        position={[10, 3, 0]}
        rotation-y={-Math.PI / 2}
        scale={[20, 5, 1]}
      />
      <Lightformer
        form="rect"
        intensity={0.35}
        color="#bfe0ff"
        position={[-10, 3, 0]}
        rotation-y={Math.PI / 2}
        scale={[20, 5, 1]}
      />
    </Environment>
  )
}

/**
 * Development only: `?at=space` starts you in Space World, so it can be checked
 * without rebirthing first. Production builds
 * always start in the lobby.
 */
const START = (() => {
  if (!import.meta.env.DEV) return SPAWN
  const at = new URLSearchParams(location.search).get('at')
  return { space: SPACE_SPAWN }[at] ?? SPAWN
})()

/**
 * Development only: `window.__fpc` - the game store and a way to move the player -
 * for poking at the game from the browser console (and the screenshot scripts).
 */
function DevHandle({ bodyRef }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    window.__fpc = {
      useGame,
      gl,
      scene,
      teleport: (x, y, z) => {
        bodyRef.current?.setTranslation({ x, y, z }, true)
        bodyRef.current?.setLinvel({ x: 0, y: 0, z: 0 }, true)
      },
      where: () => bodyRef.current?.translation(),
    }
    return () => {
      delete window.__fpc
    }
  }, [bodyRef, gl, scene])
  return null
}

export function GameScene({ bodyRef: externalBodyRef }) {
  const { game } = useBloxity()
  const localPlayerBodyRef = useRef(null)
  const playerBodyRef = externalBodyRef ?? localPlayerBodyRef
  // The eased stand-in for the body, which is what anything on screen follows.
  // See game/playerAnchor.js for why the two are not the same thing.
  const playerAnchorRef = useRef(null)
  // Graphics level, pushed in from the portal's pause menu (see game/settings.js).
  const quality = useSettings((s) => s.quality)
  const { dpr, shadows, physicsHz, solverIterations } = qualityOf(quality)

  /**
   * What the renderer is built with, fixed for the session.
   *
   * Everything else the graphics level changes can be pushed at a live renderer;
   * these belong to the drawing buffer, which exists from the moment the canvas gets
   * its context. R3F reads the `gl` prop once and never again, so re-reading the
   * level here would silently do nothing - hence the state initialiser, which says
   * plainly that the level at the first render is the one that counts.
   *
   * `stencil: false` drops a buffer nothing in the game draws through, which is a
   * byte per pixel the GPU stops reading and writing every frame. (`alpha: false`
   * belongs next to it and is not here on purpose: three asks for an alpha channel
   * unconditionally these days and uses that parameter only for the clear colour's
   * alpha, so passing it would look like a saving and be none.)
   */
  const [glOptions] = useState(() => ({
    antialias: qualityOf(useSettings.getState().quality).antialias,
    stencil: false,
  }))

  const [avatarReady, setAvatarReady] = useState(false)
  const loadingEnded = useRef(false)

  const handleAvatarReady = useCallback(() => {
    setAvatarReady(true)
    useLoading.getState().avatarReady()
  }, [])

  // Only end the loading screen once the avatar has finished assembling *and* a
  // frame has rendered with it in place.
  const handleFirstFrame = useCallback(() => {
    if (loadingEnded.current || !avatarReady) return
    loadingEnded.current = true
    // Everything the settings drive (audio graph, renderer, camera) exists by now.
    game.applySettings()
    game.loadingEnd()
  }, [avatarReady, game])

  // The first frame usually renders before the avatar finishes downloading, so the
  // frame callback alone isn't enough — close the loading screen here too.
  useEffect(() => {
    if (!avatarReady || loadingEnded.current) return
    loadingEnded.current = true
    game.applySettings()
    game.loadingEnd()
  }, [avatarReady, game])

  useEffect(() => {
    game.loadingStep('Preparing scene…')
  }, [game])

  return (
    <Canvas
      shadows={shadows}
      dpr={dpr}
      gl={glOptions}
      camera={{ position: [0, 5, 40], fov: 60, far: 1200 }}
      onCreated={({ gl }) => gl.setClearColor('#bfe4ff')}
    >
      <ShadowToggle enabled={shadows} />
      <ContextRecovery />
      <fog attach="fog" args={['#cfeaff', 140, 420]} />
      <hemisphereLight args={['#d6ecff', '#6b8f5a', 0.42]} />
      <SunLight bodyRef={playerBodyRef} anchorRef={playerAnchorRef} />

      <LocalEnvironment />
      <Suspense fallback={null}>
        <Physics
          gravity={[0, -18, 0]}
          timeStep={1 / physicsHz}
          numSolverIterations={solverIterations}
        >
          <World bodyRef={playerBodyRef} />
          <WorldReady />
          <Player
            bodyRef={playerBodyRef}
            anchorRef={playerAnchorRef}
            position={START}
            onAvatarReady={handleAvatarReady}
          />
          <Footprints />
          <PetCompanion bodyRef={playerBodyRef} anchorRef={playerAnchorRef} />
          {/* The other players in our lobby, and sending ours (after each physics step). */}
          <RemotePlayers bodyRef={playerBodyRef} />
          <RingDirector bodyRef={playerBodyRef} />
          <NetSync bodyRef={playerBodyRef} />
          {/* Inside Physics: the camera raycasts against the world so it can't be
              pushed through a stage wall. It no-ops until the player body exists. */}
          <FollowCamera bodyRef={playerBodyRef} anchorRef={playerAnchorRef} />
          <PunchEffects bodyRef={playerBodyRef} anchorRef={playerAnchorRef} />
        </Physics>
      </Suspense>

      <PunchInput bodyRef={playerBodyRef} />
      <FirstFrameSignal onFirstFrame={handleFirstFrame} />
      <DevHandle bodyRef={playerBodyRef} />
    </Canvas>
  )
}

export default GameScene
