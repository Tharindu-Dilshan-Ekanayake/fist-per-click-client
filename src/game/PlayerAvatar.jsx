import { useGLTF } from '@react-three/drei'
import { createPortal, useFrame } from '@react-three/fiber'
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { Box3, MeshStandardMaterial, Vector3 } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

import {
  assetUrls,
  BASE_BODY_URL,
  isRealId,
  PART_SLOTS,
  skinIdOrDefault,
} from '../bloxity/avatarAssets'
import { loadOBJ, loadPartGLB, loadTexture } from '../bloxity/avatarLoader'
import { useBloxity } from '../bloxity/BloxityContext'
import { DEFAULT_PROPORTIONS } from '../bloxity/store'
import {
  animateRig,
  applyPart,
  applyProportions,
  applySkin,
  attachAccessory,
  attachHandHolder,
  collectRig,
  placeHandHolder,
} from './avatarRig'
import { useGame } from './gameStore'
import { getGlove } from './gloves'
import GloveModel from './GloveModel'

/**
 * Worn glove size relative to the shop model.
 *
 * Big on purpose - the reference game's gloves are about the size of the head - and
 * later pairs carry their own `size` on top of this.
 */
const HELD_SCALE = 1.3
/** The worn gloves' trim always glows a little, even a plain pair with no glow of its own. */
const HELD_MIN_GLOW = 0.28
/** The middle of a glove's fist, in its own frame (see GloveModel's FIST). */
const FIST_Y = -0.23
/** Gloves sit a touch down the hand from the palm, so the cuff covers the wrist. */
const HELD_OFFSET = [0, -0.03, 0]

/**
 * Keeps the avatar breathing when it is rendered outside the game (a menu preview,
 * say) with no physics body feeding it motion.
 */
const _idleMotion = { time: 0, speed: 0, grounded: true, maxSpeed: 6 }
function fallbackMotion(delta) {
  _idleMotion.time += delta
  return _idleMotion
}

/**
 * The player's own Bloxity avatar, assembled at runtime.
 *
 * `player.glb` is the base humanoid rig: six skinned meshes (head, torso, two arms,
 * two legs) sharing one skeleton. Assembly means, per equipped slot:
 *   - body parts  -> swap the matching mesh's geometry
 *   - hat / back  -> attach an OBJ to the Neck1 / Spine2 bone
 *   - skin        -> set one texture as the map on every skinned mesh
 *
 * Any slot that is unequipped or 404s leaves the base body's own part in place. The
 * whole thing re-assembles when `onAvatarChanged` / `onProportionsChanged` fire, so
 * changing cosmetics in the Bloxity portal updates the character live.
 *
 * @param {{ onReady?: () => void, targetHeight?: number, remote?: boolean,
 *           equipped?: object, proportions?: object, gloveId?: string }} props
 *   `targetHeight` is the world-space height to fit the avatar into, in the game's
 *   own units. Bloxity authors the rig ~6.4 units tall with the feet at y=0, which is
 *   far bigger than a metric-scale physics capsule, so the model is measured and
 *   rescaled rather than trusted at native size.
 *   `remote` renders another player: their `equipped` / `proportions` / `gloveId`
 *   come from the lobby server instead of our own Bloxity session and game state.
 */
export const PlayerAvatar = forwardRef(function PlayerAvatar(
  {
    onReady,
    targetHeight = 1.8,
    motionRef,
    remote = false,
    equipped: remoteEquipped = null,
    proportions: remoteProportions,
    gloveId,
    fistsRef,
    ...props
  },
  ref,
) {
  const bloxity = useBloxity()
  const { game } = bloxity
  const equipped = remote ? remoteEquipped : bloxity.avatar
  const proportions = remote ? (remoteProportions ?? DEFAULT_PROPORTIONS) : bloxity.proportions
  const { scene: baseScene } = useGLTF(BASE_BODY_URL)
  const [assembled, setAssembled] = useState(false)

  // The GLTF cache hands back one shared scene. Clone via SkeletonUtils so this
  // instance gets an independent, still-working skeleton.
  const character = useMemo(() => cloneSkeleton(baseScene), [baseScene])

  // Rig lookup tables (bones, part meshes, pristine geometries) built once per clone.
  const rig = useMemo(() => {
    const collected = collectRig(character)

    // The base body ships with an empty texture; give every skinned mesh its own
    // material instance so a skin swap here can't leak into another avatar.
    for (const mesh of collected.skinnedMeshes) {
      mesh.material = new MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 1,
      })
    }

    if (!collected.skeleton) {
      console.warn('[bloxity] player.glb has no skeleton - avatar will not deform')
    }
    return collected
  }, [character])

  // Empty objects on the forearm bones; the gloves are portalled into them.
  const hands = useMemo(() => ({ right: attachHandHolder(rig, 'right'), left: attachHandHolder(rig, 'left') }), [rig])
  const ownGlove = useGame((s) => s.equipped)
  const glove = getGlove(remote ? gloveId : ownGlove)
  /** 0-1 per hand, brightest as the punch lands, then fading; read by GloveModel. */
  const flashR = useRef(0)
  const flashL = useRef(0)

  // Measured once, from the bind pose, before proportions touch the root scale.
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(character)
    const size = box.getSize(new Vector3())
    if (!Number.isFinite(size.y) || size.y <= 0) return { scale: 1, footOffset: 0 }
    const scale = targetHeight / size.y
    // The rig's feet sit at its bbox minimum; drop the group so they land on y=0
    // of the parent (which Player positions at the bottom of the capsule).
    return { scale, footOffset: -box.min.y * scale }
  }, [character, targetHeight])

  // --- Assemble equipped cosmetics --------------------------------------------
  useEffect(() => {
    let cancelled = false
    // Accessories are re-attached on every rebuild; track them so the previous
    // hat/back can be removed rather than stacking up.
    const attached = []

    // Only our own avatar is part of the loading screen.
    if (!remote) game.loadingStep('Loading avatar…')

    const jobs = []

    // Skin always loads - "0" is the fallback, since the base body has no baked map.
    jobs.push(
      loadTexture(assetUrls.skinTexture(skinIdOrDefault(equipped?.skinId))).then(
        (texture) => ({ kind: 'skin', texture }),
      ),
    )

    // Body parts: fetch only real ids; a missing slot resets to the base geometry.
    for (const [slot, cfg] of Object.entries(PART_SLOTS)) {
      const id = equipped?.[cfg.idKey]
      if (!isRealId(id)) {
        jobs.push(Promise.resolve({ kind: 'part', slot, scene: null }))
        continue
      }
      jobs.push(
        loadPartGLB(assetUrls.part(slot, id)).then((scene) => ({
          kind: 'part',
          slot,
          scene,
        })),
      )
    }

    // Accessories.
    for (const [kind, idKey, meshUrl, texUrl] of [
      ['hat', 'hatId', assetUrls.hatMesh, assetUrls.hatTexture],
      ['back', 'backId', assetUrls.backMesh, assetUrls.backTexture],
    ]) {
      const id = equipped?.[idKey]
      if (!isRealId(id)) continue
      jobs.push(
        Promise.all([loadOBJ(meshUrl(id)), loadTexture(texUrl(id))]).then(
          ([object, texture]) => ({ kind: 'accessory', accessory: kind, object, texture }),
        ),
      )
    }

    Promise.all(jobs)
      .then((results) => {
        if (cancelled) return

        for (const result of results) {
          // One bad slot must not take the rest of the character down.
          try {
            if (result.kind === 'skin') {
              applySkin(rig, result.texture)
            } else if (result.kind === 'part') {
              applyPart(rig, result.slot, result.scene)
            } else if (result.kind === 'accessory' && result.object) {
              if (result.texture) {
                result.object.traverse((child) => {
                  if (child.isMesh) {
                    child.material = new MeshStandardMaterial({ map: result.texture })
                  }
                })
              }
              const added = attachAccessory(rig, result.accessory, result.object)
              if (added) attached.push(added)
            }
          } catch (err) {
            console.warn(`[bloxity] failed to apply ${result.kind}`, err)
          }
        }

        // The arm parts may have just changed shape, so re-find the palms.
        for (const holder of [hands.right, hands.left]) if (holder) placeHandHolder(rig, holder)

        setAssembled(true)
      })
      .catch((err) => {
        console.warn('[bloxity] avatar assembly failed; showing base body', err)
        if (!cancelled) setAssembled(true)
      })

    return () => {
      cancelled = true
      for (const object of attached) {
        object.parent?.remove(object)
        object.traverse((child) => child.geometry?.dispose())
      }
    }
  }, [rig, hands, equipped, game, remote])

  // --- Proportions -------------------------------------------------------------
  // Applied per frame rather than in an effect: every bone is reset to its rest pose
  // and re-scaled each pass, which keeps it idempotent and survives anything else
  // that touches the skeleton.
  const proportionsRef = useRef(proportions)
  proportionsRef.current = proportions

  useFrame((_state, delta) => {
    try {
      // Order matters: proportions reset every bone to its rest pose, and the
      // animation then rotates on top of that clean base.
      applyProportions(rig, proportionsRef.current)
      const motion = motionRef?.current ?? fallbackMotion(delta)
      animateRig(rig, motion)
      // Each hand's punch counts up from 0 (thrown) to 1 (back on guard); the trim
      // flares as the punch reaches full stretch and fades on the way back.
      const flare = (p) => (p >= 0.15 && p < 1 ? (1 - (p - 0.15) / 0.85) ** 1.5 : 0)
      flashR.current = flare(motion.punchR)
      flashL.current = flare(motion.punchL)
    } catch {
      // A malformed payload must not kill the render loop.
    }
  })

  // Signal readiness only once the model is actually standing there.
  useEffect(() => {
    if (assembled) onReady?.()
  }, [assembled, onReady])

  return (
    <group ref={ref} {...props}>
      {/* Fit scale lives on this wrapper, not on `character` - applyProportions
          overwrites the character's own scale every frame. */}
      <group scale={fit.scale} position={[0, fit.footOffset, 0]}>
        <primitive object={character} />
      </group>
      {/* The holders live in the rig's native units; undo the fit scale so the
          gloves are authored in world units like everything else. The model is the
          left glove; the right is its mirror image (side -1). */}
      {hands.right &&
        createPortal(
          <group scale={HELD_SCALE / fit.scale} position={HELD_OFFSET}>
            <GloveModel glove={glove} side={-1} minGlow={HELD_MIN_GLOW} flashRef={flashR} sparkles={!remote} />
            <object3D
              position={[0, FIST_Y * glove.size, 0]}
              ref={(el) => {
                if (fistsRef) fistsRef.current = { ...fistsRef.current, right: el }
              }}
            />
          </group>,
          hands.right,
        )}
      {hands.left &&
        createPortal(
          <group scale={HELD_SCALE / fit.scale} position={HELD_OFFSET}>
            <GloveModel glove={glove} side={1} minGlow={HELD_MIN_GLOW} flashRef={flashL} sparkles={!remote} />
            <object3D
              position={[0, FIST_Y * glove.size, 0]}
              ref={(el) => {
                if (fistsRef) fistsRef.current = { ...fistsRef.current, left: el }
              }}
            />
          </group>,
          hands.left,
        )}
    </group>
  )
})

useGLTF.preload(BASE_BODY_URL)

export default PlayerAvatar
