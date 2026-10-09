import { BoxGeometry, ConeGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Shared, lazily built geometry.
 *
 * Everything in this map is drawn dozens of times - thirty-six crowns, forty-nine
 * crystal clusters, a sword pad for every blade in the shop - and JSX geometry
 * elements (`<boxGeometry />`) build a fresh BufferGeometry for each one. That is a
 * separate upload and a separate set of GPU buffers per copy, for shapes that are
 * bit-for-bit identical.
 *
 * Nothing here is ever disposed: these are a fixed, small set of shapes that live as
 * long as the game does, and the whole point is that a shape survives the props that
 * use it being unmounted and remounted as the player walks past.
 */
const cache = new Map()

/**
 * @param {string} key unique to the shape *and its arguments*
 * @param {() => any} make a geometry, or a small record of them
 */
export function geometry(key, make) {
  let entry = cache.get(key)
  if (!entry) {
    entry = make()
    cache.set(key, entry)
  }
  return entry
}

/** Merges `parts` into one geometry and disposes them. */
export function merge(parts) {
  const merged = mergeGeometries(parts)
  for (const part of parts) part.dispose()
  return merged
}

/**
 * A 1x1x1 box at the origin. Everything voxel-shaped in this game is one of these
 * scaled to size - a pet is about thirty-five of them - so they all share it.
 */
export const unitBox = () => geometry('unit-box', () => new BoxGeometry(1, 1, 1))

/** A four-sided unit pyramid: pet ears, fur spikes, horns and claws. */
export const unitSpike = () => geometry('unit-spike', () => new ConeGeometry(1, 1, 4))
