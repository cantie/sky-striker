import { Component, type ReactNode } from 'react'
import { models } from '../../game/assets/modelCache'

/**
 * Catches a model that failed to load (models outside the briefing's set load mid-game, over a phone's
 * network): draws nothing in its place instead of taking the whole scene down, then tries again, waiting
 * twice as long each time up to a minute. `retry` (the model cache's forgetFailures) makes it refetch.
 */
export class ModelBoundary extends Component<{ children?: ReactNode; retryMs?: number; retry?: () => void }, { failed: boolean; tries: number }> {
  state = { failed: false, tries: 0 }
  private timer?: ReturnType<typeof setTimeout>

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    clearTimeout(this.timer)
    const wait = Math.min(60_000, (this.props.retryMs ?? 4000) * 2 ** this.state.tries)
    const retry = this.props.retry ?? models.forgetFailures
    this.timer = setTimeout(() => {
      retry()
      this.setState((s) => ({ failed: false, tries: s.tries + 1 }))
    }, wait)
  }

  componentWillUnmount() {
    clearTimeout(this.timer)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
