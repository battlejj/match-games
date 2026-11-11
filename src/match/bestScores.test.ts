// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const load = () => import('./bestScores')
const BOARD = 'math:addition:medium:up'

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})

describe('best scores', () => {
  it('records only real improvements', async () => {
    const { recordBestScore } = await load()
    expect(recordBestScore(BOARD, 12)).toBe(true) // first game
    expect(recordBestScore(BOARD, 12)).toBe(false) // tie
    expect(recordBestScore(BOARD, 14)).toBe(false) // worse
    expect(recordBestScore(BOARD, 9)).toBe(true) // better
    expect(localStorage.getItem(`match-best-v1:${BOARD}`)).toBe('9')
  })

  it('reads scores saved by earlier versions', async () => {
    localStorage.setItem(`match-best-v1:${BOARD}`, '10')
    const { recordBestScore } = await load()
    expect(recordBestScore(BOARD, 10)).toBe(false)
    expect(recordBestScore(BOARD, 8)).toBe(true)
  })
})
