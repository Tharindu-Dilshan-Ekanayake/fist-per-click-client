import { create } from 'zustand'

/**
 * What the loading screen waits for: the map drawn at least once, and the player's
 * avatar assembled (or given up on, in which case a stand-in body is shown).
 */
export const useLoading = create((set) => ({
  world: false,
  avatar: false,
  worldReady: () => set({ world: true }),
  avatarReady: () => set({ avatar: true }),
}))
