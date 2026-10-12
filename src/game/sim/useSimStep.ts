import { useEffect, useRef } from 'react'
import { registerSystem, type StepInfo } from './clock'

/**
 * Run `fn` once per fixed simulation step (see clock.ts) instead of once per rendered frame.
 * The latest `fn` is always used, so it can close over fresh props/state like useFrame.
 */
export function useSimStep(order: number, fn: (s: StepInfo) => void): void {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => registerSystem(order, (s) => ref.current(s)), [order])
}
