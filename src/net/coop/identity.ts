const GUEST_KEY = 'sky-striker-coop-guest'

/** Guests may fly co-op unless the game server says GUEST_COOP=false (no server or an old one: allowed). */
export const guestsMayCoop = (config: { guestCoop?: boolean } | null) => config?.guestCoop !== false

type Store = Pick<Storage, 'getItem' | 'setItem'>

/**
 * Who we fly co-op as: the logged-in game account, or a guest kept in this browser (random id in
 * localStorage, so a reload is the same player and can REJOIN). Guest ids never clash with accounts.
 */
export function coopIdentity(user: { id: number; name: string } | null, store: Store = localStorage): { userId: string; name: string } {
  if (user) return { userId: String(user.id), name: user.name }
  let id = store.getItem(GUEST_KEY)
  if (!id || !/^[0-9a-f]{24}$/.test(id)) {
    // getRandomValues, not randomUUID: the dev server is also opened over plain http on the LAN
    id = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('')
    store.setItem(GUEST_KEY, id)
  }
  return { userId: `guest-${id}`, name: `Guest ${id.slice(0, 4).toUpperCase()}` }
}
