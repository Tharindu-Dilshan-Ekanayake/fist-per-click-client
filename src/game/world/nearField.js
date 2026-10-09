import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  Points,
} from 'three'

import { SPAWN } from './themes'

/**
 * Player-centred mounting.
 *
 * The map is one long corridor with nineteen stages hanging off it, and every
 * decorative thing in it used to be mounted from the moment the game loaded: at the
 * spawn point that was two thousand meshes and two thousand draw calls, most of them
 * crowns and crystals sitting inside side rooms four hundred units away that the
 * player cannot see and will not reach for an hour. Frustum culling does not save
 * you from that - the objects still exist, still have their matrices updated, still
 * get tested against the camera *and* the shadow camera, and a corridor pointing
 * down -Z puts most of them inside the frustum anyway.
 *
 * So: only mount what is near. Everything the world builds as a list goes through
 * `useNear` below, and the player's position drives it.
 */

/**
 * How far the player moves before the mounted set is recomputed.
 *
 * Re-filtering every frame would re-render the whole world every frame, which costs
 * far more than it saves. Snapping to a grid this size means one re-render per band
 * crossed - a few a minute at a walk - and `useNear` adds the band back onto every
 * radius so nothing is ever dropped while it is still in range.
 */
export const BAND = 16

/**
 * How wide the world mounts for its first frame, so that one of everything is in the
 * scene for ShaderWarmup to compile. Far enough to reach past the first stage's
 * cabin, which is where the last of the map's material kinds first appear.
 */
export const WARMUP_VIEW = 150

const snap = (v) => Math.round(v / BAND) * BAND

/**
 * The player's position snapped to the BAND grid. The returned object identity only
 * changes when they cross into a new band, so a component reading this re-renders
 * then and not otherwise.
 *
 * @param {React.MutableRefObject<any>} bodyRef the player's Rapier body
 */
export function useBand(bodyRef) {
  const [band, setBand] = useState(() => ({ x: snap(SPAWN[0]), z: snap(SPAWN[2]) }))
  // The state value is what the render tree sees; this is what the frame loop
  // compares against, so a band change is pushed exactly once.
  const current = useRef(band)

  useFrame(() => {
    const p = bodyRef.current?.translation()
    if (!p) return
    const x = snap(p.x)
    const z = snap(p.z)
    if (x === current.current.x && z === current.current.z) return
    current.current = { x, z }
    setBand(current.current)
  })

  return band
}

/**
 * How many things may be mounted, and unmounted, in any one frame.
 *
 * Crossing a band brings a handful of new walls and props into range, and mounting
 * one is not cheap: a stage wall alone is some forty React elements, a pair of
 * canvases, a rigid body and two colliders. Doing the whole crossing at once cost
 * about 60ms in a single frame - three or four frames dropped, every sixteen metres,
 * which at a walking pace is a lurch every seven or eight steps and is precisely what
 * this map felt like.
 *
 * Spreading the same work over a few frames costs the same in total and none of it
 * is noticeable. Additions are kept to one a frame because they are the expensive
 * side; removals are lighter, and the loading screen's wide view has several hundred
 * of them to give back at once, so they go faster.
 *
 * The slack in `useNearField`'s radius is what makes this safe: things come into
 * range a whole band before they could matter, so arriving a tenth of a second late
 * is invisible. Nothing is ever needed the instant it enters the set.
 */
const ADD_BUDGET = 1
const REMOVE_BUDGET = 6

/**
 * A jump further than this is a teleport, not a walk, and the whole set is taken at
 * once. Feeding a Win pad's trip home or a portal through the budget above would
 * build the far end of the map in front of the player over the best part of a
 * second; a single expensive frame is much the better trade when the view has just
 * changed completely anyway.
 */
const TELEPORT_BANDS = 3

/** Everything in `list` within `radius` of the band, horizontally. */
function inRange(list, band, radius, at) {
  // The band is only accurate to its own size, so pay that back before testing.
  const r = radius + BAND
  const r2 = r * r
  return list.filter((item) => {
    const p = at(item)
    const dx = p[0] - band.x
    const dz = p[2] - band.z
    return dx * dx + dz * dz <= r2
  })
}

const distanceSq = (item, band, at) => {
  const p = at(item)
  const dx = p[0] - band.x
  const dz = p[2] - band.z
  return dx * dx + dz * dz
}

/**
 * The near set for each of `fields`, brought towards what the player's position
 * calls for a few items at a time.
 *
 * Each field's array keeps its identity for as long as its membership does, so a
 * memoised list component renders only when its own contents actually change -
 * walking down a corridor re-renders the wall list and leaves the other nine alone.
 *
 * Height is ignored throughout: nothing in this map is stacked far enough up for it
 * to matter, and leaving it out keeps a crown on a four-metre plinth in range of the
 * floor below.
 *
 * @param {{ key: string, list: any[], at: (item: any) => number[] }[]} fields
 *   Stable for the life of the component - the layout is built once.
 * @param {{ x: number, z: number }} band from useBand
 * @param {number} radius how far away something is still worth mounting
 * @returns {Record<string, any[]>}
 */
export function useNearField(fields, band, radius) {
  const [mounted, setMounted] = useState(() => {
    // The first set is taken whole: the loading screen is still up, and the shader
    // warm-up needs one of everything in the scene before it can compile.
    const out = {}
    for (const field of fields) out[field.key] = inRange(field.list, band, radius, field.at)
    return out
  })

  // What the render tree is currently showing, for the frame loop to compare against.
  const shown = useRef(mounted)
  useEffect(() => {
    shown.current = mounted
  }, [mounted])

  /** The target set, recomputed only when the player crosses a band. */
  const target = useRef(null)

  useFrame(() => {
    const plan = target.current
    if (!plan || plan.band !== band || plan.radius !== radius) {
      const want = {}
      const whole = {}
      for (const field of fields) {
        const near = inRange(field.list, band, radius, field.at)
        want[field.key] = new Set(near)
        whole[field.key] = near
      }
      const jumped =
        plan &&
        Math.max(Math.abs(band.x - plan.band.x), Math.abs(band.z - plan.band.z)) > TELEPORT_BANDS * BAND
      target.current = { band, radius, want }
      if (jumped) setMounted(whole)
      return
    }

    const have = shown.current
    let adds = ADD_BUDGET
    let removes = REMOVE_BUDGET
    let changed = false
    const next = {}

    for (const field of fields) {
      const want = plan.want[field.key]
      const here = have[field.key]

      if (removes > 0) {
        const keep = here.filter((item) => want.has(item))
        const dropped = here.length - keep.length
        if (dropped > 0) {
          if (dropped <= removes) {
            removes -= dropped
            next[field.key] = keep
            changed = true
            continue
          }
          // More to drop than the budget allows: take the furthest away first.
          const doomed = here
            .filter((item) => !want.has(item))
            .sort((a, b) => distanceSq(b, band, field.at) - distanceSq(a, band, field.at))
            .slice(0, removes)
          const cut = new Set(doomed)
          removes = 0
          next[field.key] = here.filter((item) => !cut.has(item))
          changed = true
          continue
        }
      }

      if (adds > 0 && here.length < want.size) {
        const present = new Set(here)
        const missing = [...want]
          .filter((item) => !present.has(item))
          .sort((a, b) => distanceSq(a, band, field.at) - distanceSq(b, band, field.at))
          .slice(0, adds)
        if (missing.length > 0) {
          adds -= missing.length
          next[field.key] = here.concat(missing)
          changed = true
          continue
        }
      }

      next[field.key] = here
    }

    if (changed) setMounted(next)
  })

  return mounted
}

/**
 * Compiles every shader the map needs, and then keeps them.
 *
 * A WebGL program is only built the first time something using it is actually drawn,
 * and building one blocks until the driver has finished linking it. In a map that
 * mounts as you walk, that lands mid-game: the first stage wall to come into view
 * brought ten programs with it and cost most of half a second in a single frame,
 * which is the lurch you feel every so often on the way to the gate.
 *
 * So the world mounts wide for its first frame (WARMUP_VIEW) and this compiles the
 * lot while the loading screen is still up. On its own that is not enough: three.js
 * reference-counts programs against the materials using them, and the moment the
 * world shrinks back to its real view distance those materials are disposed and the
 * programs are deleted again - the warm-up would compile two dozen shaders and throw
 * most of them away seconds later, only to rebuild them one at a time, mid-walk, as
 * the player reached each thing for real.
 *
 * Hence the holder: one clone of every material, hidden, never unmounted, holding a
 * reference to each program for the life of the session. The clones are never drawn
 * (compile walks the whole scene, not just what is visible) and they share the
 * cached textures and geometry the originals used, so what they cost is a few
 * hundred small objects, once.
 */
/**
 * Has every material in the scene look its shader up again on its next draw (and,
 * with `textures`, every texture re-upload). Cheap when nothing changed - three.js
 * hands back the program it already has for the same settings - and the cure when
 * something did: a program lost while the GPU was swamped at load, or the whole
 * context lost and restored.
 */
export function refreshMaterials(scene, { textures = false } = {}) {
  scene.traverse((object) => {
    if (!object.material) return
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      material.needsUpdate = true
      if (!textures) continue
      for (const value of Object.values(material)) if (value?.isTexture) value.needsUpdate = true
    }
  })
}

/** Frames to wait after the warm-up before the refresh, so the world has shrunk by then. */
const REFRESH_AFTER_FRAMES = 3

export function ShaderWarmup({ onDone }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  /** Which of the two warm-up frames we are on; see useFrame below. */
  const step = useRef(0)
  /** The hidden holder, kept out of React so that nothing can unmount it. */
  const holder = useRef(null)
  /** Frames left until the post-warm-up refresh; -1 while there is none due. */
  const refreshIn = useRef(-1)

  useEffect(() => {
    // Only on a real teardown of the canvas; the world shrinking must not touch it.
    return () => {
      const group = holder.current
      if (!group) return
      group.removeFromParent()
      for (const child of group.children) {
        child.material?.dispose()
        child.geometry?.dispose()
      }
      group.clear()
      holder.current = null
    }
  }, [])

  useFrame(() => {
    // Once the world has settled at its real size, every material it kept checks its
    // shader again. On a GPU still busy linking the warm-up's programs, one of them
    // could come out unusable, and everything drawn with it silently vanished - the
    // ground, the sky, the blocks - leaving the game standing in empty air.
    if (refreshIn.current >= 0 && refreshIn.current-- === 0) refreshMaterials(scene)

    const n = step.current++
    if (n > 1) return

    // Frame one: build every program the wide scene needs. This also forces into
    // existence the materials three.js makes for itself along the way - the depth
    // variants behind the shadow pass, most of all - which is why the holder is not
    // gathered until the frame after.
    if (n === 0) {
      try {
        gl.compile(scene, camera)
      } catch {
        /* the second frame still runs, and so does onDone */
      }
      return
    }

    // However this goes, the world must not be left waiting on the warm-up.
    const finish = () => {
      refreshIn.current = REFRESH_AFTER_FRAMES
      onDone()
    }

    try {
      const group = new Group()
      group.visible = false
      group.frustumCulled = false

      /**
       * A one-triangle geometry with the same attributes as the real one.
       *
       * Which attributes a geometry has is part of what three.js builds the shader
       * from - colours, uvs and normals each change it - so a stand-in made of bare
       * positions would hold a reference to the wrong program and leave the real one
       * to be built mid-game after all. Only the shape of the attributes is copied,
       * never their contents, so nothing here keeps a real buffer alive.
       */
      const stubs = new Map()
      const stubFor = (geometry) => {
        const names = Object.keys(geometry.attributes).sort()
        const signature = names.map((n2) => `${n2}:${geometry.attributes[n2].itemSize}`).join()
        let stub = stubs.get(signature)
        if (!stub) {
          stub = new BufferGeometry()
          for (const name of names) {
            const { itemSize } = geometry.attributes[name]
            stub.setAttribute(name, new BufferAttribute(new Float32Array(3 * itemSize), itemSize))
          }
          stubs.set(signature, stub)
        }
        return stub
      }

      const seen = new Set()
      scene.traverse((object) => {
        if (!object.isMesh && !object.isPoints && !object.isLine && !object.isSprite) return
        if (!object.geometry) return
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of materials) {
          if (!material || seen.has(material.uuid)) continue
          seen.add(material.uuid)

          const stub = stubFor(object.geometry)
          let stand
          if (object.isInstancedMesh) {
            // Instanced draws compile to their own shader, and per-instance colours
            // change it again - the wall debris has both.
            stand = new InstancedMesh(stub, material.clone(), 1)
            if (object.instanceColor) {
              stand.instanceColor = new InstancedBufferAttribute(new Float32Array(3), 3)
            }
          } else if (object.isPoints) {
            stand = new Points(stub, material.clone())
          } else {
            stand = new Mesh(stub, material.clone())
          }
          // The shadow pass compiles a second shader for anything that casts or
          // receives, so the stand-in has to ask for the same ones.
          stand.castShadow = object.castShadow
          stand.receiveShadow = object.receiveShadow
          stand.frustumCulled = false
          group.add(stand)
        }
      })

      holder.current = group
      scene.add(group)

      if (gl.compileAsync) {
        gl.compileAsync(scene, camera).then(finish, finish)
      } else {
        gl.compile(scene, camera)
        finish()
      }
    } catch {
      finish()
    }
  })

  return null
}
