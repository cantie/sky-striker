import { useEffect, useState } from 'react'
import { activeSession } from '../../net/coop/active'
import type { RosterEntry, SessionStatus } from '../../net/coop/coopSession'
import type { RunSummary, TeamStats } from '../../net/coop/protocol'

export interface CoopView { status: SessionStatus | null; team: TeamStats; summary: RunSummary | null; roster: RosterEntry[] }

const read = (): CoopView => {
  const s = activeSession()
  return { status: s?.status() ?? null, team: s?.team ?? { score: 0, kills: 0 }, summary: s?.summary ?? null, roster: s?.roster() ?? [] }
}

/** The running co-op session, polled for the UI (same cadence as CoopBadge). */
export function useCoopStatus(ms = 250): CoopView {
  const [view, setView] = useState(read)
  useEffect(() => {
    const id = setInterval(() => setView(read()), ms)
    return () => clearInterval(id)
  }, [ms])
  return view
}
