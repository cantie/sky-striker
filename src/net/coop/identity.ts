import { readToken } from '../api'
import { useAccount } from '../../store/account'

/** Nakama custom-id prefix for a pilot who has not signed in. The co-op match refuses these when GUEST_COOP=false. */
export const GUEST_ID_PREFIX = 'guest:'
const GUEST_STORAGE_KEY = 'sky-striker-guest-id'

export function guestCoopAllowed(flag: boolean | undefined | null): boolean {
  return flag !== false
}

export function loadGuestId(): string {
  try {
    const existing = localStorage.getItem(GUEST_STORAGE_KEY)
    if (existing?.startsWith(GUEST_ID_PREFIX)) return existing
  } catch { /* private mode: a fresh id for this call */ }
  const id = `${GUEST_ID_PREFIX}${crypto.randomUUID()}`
  try { localStorage.setItem(GUEST_STORAGE_KEY, id) } catch { /* still usable this session */ }
  return id
}

export interface CoopWho {
  /** True when nobody is signed in. */
  guest: boolean
  user: { id: number; name: string } | null
  guestCoop: boolean | undefined | null
  token: string | null
  guestId: string
}

export type CoopIdentity =
  | { ok: true; userId: string; name: string; token?: string; guest: boolean }
  | { ok: false; reason: string }

/** Signed-in pilots always pass. Guests pass only while guest co-op is enabled. */
export function resolveCoopIdentity(who: CoopWho): CoopIdentity {
  if (!who.guest && who.user) {
    const name = who.user.name.trim() || 'Pilot'
    return { ok: true, userId: `skystriker-${who.user.id}`, name, token: who.token || undefined, guest: false }
  }
  if (!guestCoopAllowed(who.guestCoop)) return { ok: false, reason: 'Log in to play co-op' }
  const userId = who.guestId.startsWith(GUEST_ID_PREFIX) ? who.guestId : `${GUEST_ID_PREFIX}${who.guestId}`
  return { ok: true, userId, name: 'Guest', guest: true }
}

/** Identity for the account currently on this device. */
export function readCoopIdentity(): CoopIdentity {
  const { status, user, config } = useAccount.getState()
  if (status === 'init' || status === 'busy') return { ok: false, reason: 'Still signing in' }
  return resolveCoopIdentity({
    guest: status !== 'user',
    user,
    guestCoop: config?.guestCoop,
    token: readToken(),
    guestId: loadGuestId(),
  })
}
