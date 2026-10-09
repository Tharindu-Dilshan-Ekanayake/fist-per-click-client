import { Box3, Matrix4, NearestFilter, Object3D, Quaternion, Vector3 } from 'three'

import { BACK_BONE, HAT_BONE, NECK_OFFSET_BONE, PART_SLOTS } from '../bloxity/avatarAssets'

/**
 * Rig manipulation for the base `player.glb` character.
 *
 * The rig's real structure (confirmed by reading player.glb directly):
 *   character
 *     - default_arm_L / default_arm_R / default_head
 *     - default_leg_L / default_leg_R / default_torso   (6 SkinnedMeshes, 1 skeleton)
 *     - Rig1
 *         - Spine1 > Spine2 > { ArmL_Offset > ArmL1 > ArmL2,
 *                               ArmR_Offset > ArmR1 > ArmR2,
 *                               Neck_Offset > Neck1 }
 *         - LegL_Offset > LegL1 > LegL2, LegR_Offset > LegR1 > LegR2
 *
 * Two consequences drive everything below:
 *  1. Body parts are NOT attached to bones. Each is a separate SkinnedMesh sharing one
 *     skeleton, so equipping a part means swapping that mesh's geometry (remapping
 *     skin indices into the base skeleton's bone order first).
 *  2. Accessories DO attach to bones: hats to `Neck1`, back items to `Spine2`.
 *
 * player.glb ships no animation clips, so the character is posed, not animated.
 */

/**
 * Walks the loaded rig and collects everything later operations need.
 *
 * @param {import('three').Object3D} root
 */
export function collectRig(root) {
  const rig = {
    root,
    skeleton: null,
    /** slot -> SkinnedMesh */
    partMeshes: {},
    /** slot -> the pristine geometry to restore on unequip */
    originalGeometries: {},
    /** bone name -> { bone, origPos, origQuat, origScale } */
    bones: {},
    hatBone: null,
    backBone: null,
    neckOffsetBindY: 0,
    skinnedMeshes: [],
    /** Rest Y of the character root, so the run-cycle bob can return to it. */
    rootRestY: root.position.y,
  }

  const meshBySlot = new Map(
    Object.entries(PART_SLOTS).map(([slot, cfg]) => [cfg.mesh.toLowerCase(), slot]),
  )

  root.traverse((node) => {
    if (node.isSkinnedMesh) {
      node.castShadow = true
      node.receiveShadow = true
      rig.skinnedMeshes.push(node)
      if (!rig.skeleton) rig.skeleton = node.skeleton

      const slot = meshBySlot.get((node.name || '').toLowerCase())
      if (slot) {
        rig.partMeshes[slot] = node
        rig.originalGeometries[slot] = node.geometry.clone()
      }
    } else if (node.isMesh) {
      node.castShadow = true
      node.receiveShadow = true
    }
  })

  const skeleton = rig.skeleton
  if (skeleton) {
    for (const bone of skeleton.bones) {
      // Proportions are re-applied every frame from these rest values.
      bone.matrixAutoUpdate = true
      rig.bones[bone.name] = {
        bone,
        origPos: bone.position.clone(),
        origQuat: bone.quaternion.clone(),
        origScale: bone.scale.clone(),
      }
    }

    // Bone local axes are NOT world-aligned in this rig: a limb bone's local X
    // points along world -Z and its local Z along world -X, so rotating a leg about
    // its local X swings it sideways instead of forward/back. The offsets differ per
    // bone (Spine1 is identity, ArmL2 is off by ~14 degrees), so rather than hardcode
    // an axis, record for each bone the local-space axis matching each character-space
    // axis and animate about those.
    root.updateMatrixWorld(true)
    const rootQuat = new Quaternion()
    root.getWorldQuaternion(rootQuat)
    const rootQuatInv = rootQuat.invert()
    const boneWorld = new Quaternion()

    for (const bone of skeleton.bones) {
      const entry = rig.bones[bone.name]
      if (!entry) continue
      bone.getWorldQuaternion(boneWorld)
      // Bone orientation relative to the character, then inverted: this maps a
      // character-space axis into the bone's own local frame.
      const relInv = rootQuatInv.clone().multiply(boneWorld).invert()
      /** Local axis to rotate about for forward/back swing. */
      entry.axisX = new Vector3(1, 0, 0).applyQuaternion(relInv).normalize()
      /** Local axis to rotate about for lateral sway. */
      entry.axisZ = new Vector3(0, 0, 1).applyQuaternion(relInv).normalize()
      /** Local axis to rotate about for a twist (turning the torso into a punch). */
      entry.axisY = new Vector3(0, 1, 0).applyQuaternion(relInv).normalize()
    }

    rig.hatBone = skeleton.bones.find((b) => b.name === HAT_BONE) || null
    rig.backBone = skeleton.bones.find((b) => b.name === BACK_BONE) || null

    const neckIndex = skeleton.bones.findIndex((b) => b.name === NECK_OFFSET_BONE)
    if (neckIndex >= 0) {
      // elements[13] is the Y translation of the inverted bind matrix.
      rig.neckOffsetBindY = skeleton.boneInverses[neckIndex].clone().invert().elements[13]
    }
  }

  return rig
}

/** Bloxity textures are authored unflipped and pixel-art filtered. */
export function configureAvatarTexture(texture) {
  if (!texture) return texture
  texture.flipY = false
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.needsUpdate = true
  return texture
}

/**
 * Applies the skin texture to every skinned mesh of the base body.
 * The base body ships with an empty texture, so this always runs - with skin "0"
 * standing in when nothing is equipped.
 */
export function applySkin(rig, texture) {
  if (!texture) return
  for (const mesh of rig.skinnedMeshes) {
    if (!mesh.material) continue
    mesh.material.map = texture
    mesh.material.needsUpdate = true
  }
}

/**
 * Swaps a body part's geometry onto its base skinned mesh.
 *
 * A part GLB carries its own skeleton whose bone *order* may differ from the base
 * rig's. Its `skinIndex` attribute therefore has to be remapped by bone name, or the
 * limb deforms against the wrong bones.
 *
 * @param {object} rig from `collectRig`
 * @param {string} slot key of PART_SLOTS
 * @param {import('three').Object3D|null} partScene loaded GLB scene, or null to reset
 */
export function applyPart(rig, slot, partScene) {
  const targetMesh = rig.partMeshes[slot]
  if (!targetMesh) return

  // Unequipped / failed download: restore the part baked into player.glb.
  if (!partScene) {
    const original = rig.originalGeometries[slot]
    if (original && targetMesh.geometry !== original) targetMesh.geometry = original
    return
  }

  let skinnedSource = null
  let plainSource = null
  partScene.traverse((node) => {
    if (node.isSkinnedMesh && !skinnedSource) skinnedSource = node
    else if (node.isMesh && !plainSource) plainSource = node
  })

  if (!skinnedSource) {
    // Some parts ship as plain meshes; use them as-is.
    if (plainSource) targetMesh.geometry = plainSource.geometry
    return
  }

  const baseSkeleton = rig.skeleton
  if (!baseSkeleton || !skinnedSource.skeleton) {
    targetMesh.geometry = skinnedSource.geometry
    return
  }

  const geometry = skinnedSource.geometry.clone()

  const baseIndexByName = new Map()
  baseSkeleton.bones.forEach((bone, i) => baseIndexByName.set(bone.name, i))

  const remap = new Map()
  skinnedSource.skeleton.bones.forEach((bone, i) => {
    const baseIndex = baseIndexByName.get(bone.name)
    if (baseIndex !== undefined) remap.set(i, baseIndex)
  })

  const skinIndex = geometry.getAttribute('skinIndex')
  if (skinIndex) {
    const array = skinIndex.array
    for (let i = 0; i < array.length; i += 1) {
      const mapped = remap.get(array[i])
      if (mapped !== undefined) array[i] = mapped
    }
    skinIndex.needsUpdate = true
  }

  targetMesh.geometry = geometry
}

/**
 * Attaches a hat or back accessory to its bone.
 * Offsets are the SDK's own: hats sit at y=0.8 on `Neck1`, back items at the origin
 * of `Spine2`.
 */
export function attachAccessory(rig, kind, object) {
  const bone = kind === 'hat' ? rig.hatBone : rig.backBone
  if (!object || !bone) return null

  object.scale.setScalar(1)
  object.position.set(0, kind === 'hat' ? 0.8 : 0, 0)
  object.traverse((child) => {
    if (child.isMesh) child.castShadow = true
  })

  bone.add(object)
  return object
}

/** Forearm bones that the gloves ride on, by hand. */
const HAND_BONES = { right: 'ArmR2', left: 'ArmL2' }
/** The base body's arm meshes (`default_arm_R` / `default_arm_L`), used to find the hands. */
const ARM_MESHES = { right: /arm_r$/i, left: /arm_l$/i }

/**
 * Adds an empty holder to a forearm bone for a held item (a glove). `hand` is
 * 'right' or 'left'. Call `placeHandHolder` once the body parts are applied to move
 * it into the palm.
 */
export function attachHandHolder(rig, hand = 'right') {
  const bone = rig.bones[HAND_BONES[hand]]?.bone
  if (!bone) return null
  const holder = new Object3D()
  holder.name = `HandHolder-${hand}`
  holder.userData.hand = hand
  bone.add(holder)
  return holder
}

const _rootInv = new Matrix4()
const _boneInRoot = new Matrix4()
const _handInRoot = new Matrix4()
const _box = new Box3()
const _size = new Vector3()
const _center = new Vector3()

/**
 * Moves a hand holder to the bottom of its arm, oriented to the character
 * (so +Z is forward and +Y up while the arm hangs at rest).
 *
 * Measured in the rest pose, since bone axes aren't character-aligned (see
 * collectRig): every bone is reset, the holder's pose is solved in character space,
 * and the previous pose is restored.
 */
export function placeHandHolder(rig, holder) {
  const bone = holder.parent
  const pattern = ARM_MESHES[holder.userData.hand ?? 'right']
  const arm = rig.skinnedMeshes.find((m) => pattern.test(m.name || ''))
  if (!bone || !arm || !rig.skeleton) return

  const bones = rig.skeleton.bones
  const saved = bones.map((b) => [b.position.clone(), b.quaternion.clone(), b.scale.clone()])
  for (const b of bones) {
    const rest = rig.bones[b.name]
    b.position.copy(rest.origPos)
    b.quaternion.copy(rest.origQuat)
    b.scale.copy(rest.origScale)
  }
  rig.root.updateMatrixWorld(true)

  // Arm bounds in character space; the palm is just above its lowest point.
  _rootInv.copy(rig.root.matrixWorld).invert()
  arm.geometry.computeBoundingBox()
  _box.copy(arm.geometry.boundingBox).applyMatrix4(arm.matrixWorld).applyMatrix4(_rootInv)
  _box.getSize(_size)
  _box.getCenter(_center)
  _handInRoot.makeTranslation(_center.x, _box.min.y + _size.y * 0.1, _center.z)

  // holder = bone⁻¹ · hand, all in character space.
  _boneInRoot.multiplyMatrices(_rootInv, bone.matrixWorld)
  _boneInRoot.invert().multiply(_handInRoot).decompose(holder.position, holder.quaternion, holder.scale)

  bones.forEach((b, i) => {
    b.position.copy(saved[i][0])
    b.quaternion.copy(saved[i][1])
    b.scale.copy(saved[i][2])
  })
  rig.root.updateMatrixWorld(true)
}

/**
 * Applies Bloxity body proportions.
 *
 * Must run every frame: each bone is reset to its rest transform before the
 * multipliers are re-applied, which is what makes the result idempotent and lets
 * proportion changes take effect live.
 *
 * `height`, `armLength`, `headScale` and `neckHeight` are applied exactly as the
 * Bloxity portal does, so the in-game body matches the preview. The remaining three
 * (`shoulderWidth`, `torsoScaleX`, `legOffsetX`) are not implemented in the SDK's
 * preview renderer; they are applied here in the spirit of their names and are the
 * ones to sanity-check against the portal.
 */
export function applyProportions(rig, proportions) {
  const skeleton = rig.skeleton
  if (!skeleton || !proportions) return

  const height = proportions.height ?? 1
  const armLength = proportions.armLength ?? 1
  const headScale = proportions.headScale ?? 1
  const neckHeight = proportions.neckHeight ?? 1
  const shoulderWidth = proportions.shoulderWidth ?? 1
  const torsoScaleX = proportions.torsoScaleX ?? 1
  const legOffsetX = proportions.legOffsetX ?? 1

  // Overall height is a scale on the character root, not on a bone.
  rig.root.scale.set(1, height, 1)

  for (const bone of skeleton.bones) {
    const rest = rig.bones[bone.name]
    if (!rest) continue

    const { origScale, origPos, origQuat } = rest
    bone.position.copy(origPos)
    bone.quaternion.copy(origQuat)
    bone.scale.copy(origScale)

    const name = bone.name

    if (name.startsWith('Arm')) {
      bone.scale.y = origScale.y * armLength
      // Not in the SDK preview: widen the shoulders by pushing the arm roots out.
      if (name === 'ArmL_Offset' || name === 'ArmR_Offset') {
        bone.position.x = origPos.x * shoulderWidth
      }
    } else if (name === NECK_OFFSET_BONE) {
      // Keeps the head sitting on the neck as height/headScale change, then applies
      // neckHeight against the bind-pose offset.
      bone.position.y += (height - headScale) * origPos.y
      bone.position.y += rig.neckOffsetBindY * (neckHeight - 1) * 0.8
    } else if (name === HAT_BONE) {
      // Divided by height so the head stays uniform inside the stretched root.
      bone.scale.set(
        origScale.x * headScale,
        origScale.y * (headScale / height),
        origScale.z * headScale,
      )
    } else if (name === BACK_BONE) {
      // Not in the SDK preview: torso width.
      bone.scale.x = origScale.x * torsoScaleX
    } else if (name === 'LegL_Offset' || name === 'LegR_Offset') {
      // Not in the SDK preview: leg splay, mirrored about the rig centre.
      bone.position.x = origPos.x * legOffsetX
    }
  }
}

/* ---------------------------------------------------------------------------
 * Procedural animation
 *
 * player.glb ships zero animation clips, so a walk/run/jump cycle has to be
 * driven directly on the bones. Rotations are *multiplied onto* whatever
 * applyProportions() just wrote, so this must run immediately after it in the
 * same frame - proportions reset each bone to its rest pose, which is exactly
 * the clean base a pose needs.
 * ------------------------------------------------------------------------- */

const _animQ = new Quaternion()

/**
 * Rotates a bone about one of its precomputed character-space axes.
 * `which` is 'axisX' (forward/back swing) or 'axisZ' (lateral sway).
 */
function rotateBone(rig, name, which, angle) {
  if (!angle) return
  const entry = rig.bones[name]
  const axis = entry?.[which]
  if (!axis) return
  entry.bone.quaternion.multiply(_animQ.setFromAxisAngle(axis, angle))
}

/** Swing a limb forward/back - the plane a walk cycle actually moves in. */
const swing = (rig, name, angle) => rotateBone(rig, name, 'axisX', angle)
/** Sway a limb out to the side. */
const sway = (rig, name, angle) => rotateBone(rig, name, 'axisZ', angle)

/** Turn a bone about the character's vertical axis. */
const twist = (rig, name, angle) => rotateBone(rig, name, 'axisY', angle)

/**
 * How long one punch takes, start to finish, in seconds. An OP auto clicker throws
 * ten a second, so the two hands take turns and each has two tenths to get back.
 */
export const PUNCH_S = 0.3

/** The punches each hand throws in turn, round and round. */
export const PUNCH_STYLES = ['jab', 'cross', 'hook', 'uppercut', 'haymaker']

/** Every this many punches, both fists go at once. */
export const DOUBLE_EVERY = 10

/**
 * Which hand throws punch number `n` (1-based), and what kind of punch it is.
 *
 * On the ground the hands take turns, right then left, two of each punch in
 * PUNCH_STYLES; every DOUBLE_EVERY-th punch is a two-fisted blast (`both`). In the
 * air every punch is a flying "superman" punch. Both the puncher and everyone
 * watching work this out from the same count, so they all see the same punch.
 */
export function punchFor(n, airborne = false) {
  const right = n % 2 === 1
  if (airborne) return { right, both: false, style: 'superman' }
  if (n % DOUBLE_EVERY === 0) return { right, both: true, style: 'double' }
  const style = PUNCH_STYLES[Math.floor((n - 1) / 2) % PUNCH_STYLES.length]
  return { right, both: false, style }
}

/**
 * Poses the rig for the current motion state.
 *
 * @param {object} rig from `collectRig`
 * @param {{ time: number, speed: number, grounded: boolean, maxSpeed: number,
 *           punchR?: number, punchL?: number, styleR?: string, styleL?: string,
 *           guard?: number, hurt?: number, ko?: number, cheer?: number }} motion
 *   `speed` is horizontal speed in world units/sec; `maxSpeed` is what counts as a
 *   full-amplitude run, so the cycle scales smoothly from a walk to a sprint.
 *   `punchR` / `punchL` are each hand's punch progress: 0..1 while a punch plays,
 *   anything else when that hand is resting. `guard` 0..1 holds the gloves up.
 *   `hurt` 0..1 is a flinch from taking a hit, `ko` 0..1 a fall to the canvas, and
 *   `cheer` 0..1 both gloves thrown up in victory.
 */
export function animateRig(rig, motion) {
  if (!rig?.skeleton || !motion) return
  rig.root.rotation.x = 0
  const ratio = poseLocomotion(rig, motion)
  poseArms(rig, motion, ratio)
  poseReactions(rig, motion)
}

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (v) => v * v * (3 - 2 * v)
const easeOut = (v) => 1 - (1 - v) ** 3

/**
 * How far into its strike a punch is, from its progress: a quick pull back, a snap
 * out to full reach, a beat held there, then back to guard. Below zero is the pull
 * back.
 */
function strike(p, style) {
  if (!(p >= 0 && p < 1)) return 0
  // The big ones draw back further before they let go.
  const windup = WINDUP[style] ?? 0.3
  if (p < 0.1) return -windup * smooth(p / 0.1)
  if (p < 0.32) return -windup + (1 + windup) * easeOut((p - 0.1) / 0.22)
  if (p < 0.45) return 1
  return 1 - smooth((p - 0.45) / 0.55)
}

/** How far back each punch draws before it is thrown. */
const WINDUP = { jab: 0.2, cross: 0.35, hook: 0.35, uppercut: 0.45, haymaker: 0.7, double: 0.5, superman: 0.25 }

/**
 * The guard and where each kind of punch reaches to, as [upper-arm swing, upper-arm
 * sway, forearm swing]. Swings are about the character's side-to-side axis (negative
 * raises the arm forward); sways are about its forward axis, given for the right arm
 * (the left mirrors them) with positive tucking the elbow in.
 */
const GUARD = [-0.55, 0.22, -1.95]
const RUN_GUARD = [-0.3, 0.12, -1.7]
const REACH = {
  jab: [-1.55, -0.18, -0.12],
  cross: [-1.62, -0.05, -0.04],
  hook: [-1.25, 0.95, -1.35],
  uppercut: [-1.75, -0.12, -1.55],
  haymaker: [-2.05, 0.7, -0.75],
  double: [-1.6, -0.32, -0.08],
  superman: [-1.85, -0.12, -0.04],
}
/** How far the torso turns into each punch, and leans into it (negative: forward). */
const BODY = {
  jab: { twist: 0.42, lean: -0.12 },
  cross: { twist: 0.75, lean: -0.2 },
  hook: { twist: 0.62, lean: -0.06 },
  uppercut: { twist: 0.3, lean: 0.12 },
  haymaker: { twist: 0.9, lean: -0.26 },
  double: { twist: 0, lean: -0.3 },
  superman: { twist: 0.35, lean: -0.32 },
}

/**
 * Both arms: up in a guard while standing (and lower, pumping, while running), and
 * each hand's punch layered on top.
 */
function poseArms(rig, motion, ratio) {
  const guard = motion.guard ?? 1
  const cycle = Math.sin(motion.phase ?? rig.cyclePhase ?? 0)
  const pump = ratio * (1 - guard * 0.6)
  let bodyTwist = 0
  let bodyLean = 0

  for (const [hand, side] of [['R', 1], ['L', -1]]) {
    const p = hand === 'R' ? motion.punchR : motion.punchL
    const style = (hand === 'R' ? motion.styleR : motion.styleL) ?? 'jab'
    const s = strike(p, style)
    const reach = REACH[style] ?? REACH.jab
    // The resting arm: the guard, sinking towards a running carry the faster you go.
    const rest = GUARD.map((g, i) => g + (RUN_GUARD[i] - g) * (1 - guard) * ratio)
    // Running pumps the arms in opposition to the legs.
    const swingRun = (hand === 'R' ? cycle : -cycle) * 0.55 * pump
    const k = Math.max(0, s)
    const pull = Math.min(0, s)
    const upper = rest[0] + (reach[0] - rest[0]) * k + swingRun - pull * 0.35
    const sideways = rest[1] + (reach[1] - rest[1]) * k
    const fore = rest[2] + (reach[2] - rest[2]) * k + pull * 0.25
    swing(rig, `Arm${hand}1`, upper)
    sway(rig, `Arm${hand}1`, sideways * side)
    swing(rig, `Arm${hand}2`, fore)

    if (s !== 0) {
      const body = BODY[style] ?? BODY.jab
      bodyTwist += body.twist * s * side
      bodyLean += body.lean * k
    }
  }
  // Turn the shoulders into the punch, and lean with it.
  twist(rig, 'Spine1', bodyTwist * 0.6)
  twist(rig, 'Spine2', bodyTwist * 0.4)
  swing(rig, 'Spine1', bodyLean)

  // The flying punch: the whole body stretches out flat behind the fist, legs back.
  const flying = Math.max(
    motion.styleR === 'superman' ? Math.max(0, strike(motion.punchR, 'superman')) : 0,
    motion.styleL === 'superman' ? Math.max(0, strike(motion.punchL, 'superman')) : 0,
  )
  if (flying > 0 && !motion.grounded) {
    rig.root.rotation.x = 0.55 * flying
    swing(rig, 'LegL1', 0.5 * flying)
    swing(rig, 'LegR1', 0.35 * flying)
    swing(rig, 'LegL2', 0.4 * flying)
  }
}

/** Taking a hit, going down, and the victory cheer. */
function poseReactions(rig, motion) {
  const hurt = motion.hurt
  if (hurt >= 0 && hurt < 1) {
    // Rocked back, then recovering.
    const k = Math.sin(hurt * Math.PI) * (1 - hurt * 0.4)
    swing(rig, 'Spine1', 0.32 * k)
    swing(rig, 'Spine2', 0.18 * k)
  }
  const ko = motion.ko
  if (ko > 0) {
    // Topples backwards from the feet and lies there, arms flung out.
    const fall = easeOut(clamp01(ko * 1.6))
    rig.root.rotation.x = -1.45 * fall
    rig.root.position.y = rig.rootRestY + 0.05 * fall
    swing(rig, 'ArmR1', -1.2 * fall)
    swing(rig, 'ArmL1', -1.2 * fall)
    sway(rig, 'ArmR1', -0.9 * fall)
    sway(rig, 'ArmL1', 0.9 * fall)
  }
  const cheer = motion.cheer
  if (cheer > 0 && !(ko > 0)) {
    // Both gloves straight up, pumping.
    const k = smooth(clamp01(cheer * 4))
    const pumpUp = Math.abs(Math.sin(cheer * Math.PI * 6)) * 0.35
    swing(rig, 'ArmR1', (-1.3 - pumpUp) * k)
    swing(rig, 'ArmL1', (-1.3 - pumpUp) * k)
    swing(rig, 'ArmR2', 0.9 * k)
    swing(rig, 'ArmL2', 0.9 * k)
  }
}

/** Legs, spine and the bob. Returns how close to a full run the motion is, 0..1. */
function poseLocomotion(rig, motion) {
  const { time = 0, speed = 0, grounded = true, maxSpeed = 6 } = motion
  const ratio = Math.min(speed / Math.max(maxSpeed, 0.001), 1)

  // Step frequency rises with speed so a sprint doesn't look like a moonwalk. The
  // phase is advanced by each frame's time step, not computed as time x frequency:
  // with that, any wobble in speed (there's always some in another player's
  // playback) shifts the phase by the *whole* elapsed time x the change, so the
  // legs flicker to random poses every frame.
  const dt = rig.cycleTime === undefined ? 0 : Math.min(Math.max(time - rig.cycleTime, 0), 0.1)
  rig.cycleTime = time
  rig.cyclePhase = ((rig.cyclePhase ?? 0) + dt * (5 + ratio * 5)) % (Math.PI * 2)

  rig.root.position.y = rig.rootRestY

  // --- Airborne: tuck the legs ------------------------------------------------
  if (!grounded) {
    swing(rig, 'LegL1', -0.55)
    swing(rig, 'LegL2', 0.75)
    swing(rig, 'LegR1', 0.3)
    swing(rig, 'LegR2', 0.2)
    swing(rig, 'Spine1', -0.1)
    return 0.4
  }

  // --- Standing still: a boxer's bounce on the balls of the feet --------------
  if (ratio < 0.04) {
    const bounce = Math.sin(time * 6)
    const breathe = Math.sin(time * 1.6)
    // Fighting stance: one foot a little forward, knees soft.
    swing(rig, 'LegL1', -0.16)
    swing(rig, 'LegL2', 0.22 + bounce * 0.04)
    swing(rig, 'LegR1', 0.14)
    swing(rig, 'LegR2', 0.18 + bounce * 0.04)
    swing(rig, 'Spine1', -0.06 + breathe * 0.015)
    rig.root.position.y = rig.rootRestY - 0.02 + Math.abs(bounce) * 0.035
    return 0
  }

  // --- Walk / run cycle -----------------------------------------------------
  // The local player supplies its own phase, which its footstep sounds follow.
  const phase = motion.phase ?? rig.cyclePhase
  const cycle = Math.sin(phase)
  const legAmp = 0.85 * ratio

  // Legs swing in opposition; knees fold on the backswing only.
  swing(rig, 'LegL1', cycle * legAmp)
  swing(rig, 'LegR1', -cycle * legAmp)
  swing(rig, 'LegL2', Math.max(0, -cycle) * 1.1 * ratio)
  swing(rig, 'LegR2', Math.max(0, cycle) * 1.1 * ratio)

  // Lean into the run, and bob once per step (twice per full cycle).
  swing(rig, 'Spine1', -0.14 * ratio)
  rig.root.position.y = rig.rootRestY + Math.abs(Math.cos(phase)) * 0.18 * ratio
  return ratio
}
