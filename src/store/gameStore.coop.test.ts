import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { useGameStore as Store } from './gameStore'

let useGameStore: typeof Store

beforeAll(async () => {
  const mem = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) })
  vi.stubGlobal('location', { search: '' })
  ;({ useGameStore } = await import('./gameStore'))
})

describe('co-op in the game store', () => {
  it('single-player: 0 HP → results (unchanged)', () => {
    const s = useGameStore.getState()
    s.startGame({ stageId: 1, seed: 1 })
    useGameStore.setState({ invincibleUntil: 0, shieldMs: 0, playerHp: 1 })
    useGameStore.getState().damagePlayer(1)
    expect(useGameStore.getState().gameState).toBe('results')
    expect(useGameStore.getState().down).toBe(false)
  })

  it('co-op: 0 HP → down (no results), frozen controls, no more damage; revive restores', () => {
    useGameStore.getState().startGame({ stageId: 2, seed: 9, mode: 'coop' })
    expect(useGameStore.getState().currentStageId).toBe(2)
    useGameStore.setState({ invincibleUntil: 0, shieldMs: 0, playerHp: 1 })
    useGameStore.getState().damagePlayer(1)
    let st = useGameStore.getState()
    expect(st.gameState).toBe('playing')
    expect(st.down).toBe(true)
    const { playerX, playerY } = st
    st.setPlayerPosition(playerX + 3, playerY + 3)
    expect(useGameStore.getState().playerX).toBe(playerX)
    st.revivePlayer(1, -2, 2)
    st = useGameStore.getState()
    expect(st).toMatchObject({ down: false, playerHp: 2, playerX: 1, playerY: -2 })
    expect(st.invincibleUntil).toBeGreaterThan(Date.now())
  })

  it('co-op: clearing a stage waits for the next one instead of the results screen', () => {
    useGameStore.getState().startGame({ stageId: 1, seed: 2, mode: 'coop' })
    useGameStore.getState().finishStageWin()
    expect(useGameStore.getState().gameState).toBe('coopStageClear')
  })

  it('co-op ignores ?boss / ?easy / ?stage test switches', () => {
    vi.stubGlobal('location', { search: '?boss&easy&stage=7' })
    useGameStore.getState().startGame({ stageId: 3, seed: 2, mode: 'coop' })
    const st = useGameStore.getState()
    expect(st.currentStageId).toBe(3)
    expect(st.easyMode).toBe(false)
    expect(st.gameState).toBe('playing')
    vi.stubGlobal('location', { search: '' })
  })
})
