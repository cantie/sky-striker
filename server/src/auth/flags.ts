/**
 * Guest pilots may fly co-op unless GUEST_COOP is false, 0 or no (unset or blank: allowed). Same rule as
 * guest_coop_on() in the Nakama co-op match, which is what actually refuses a guest; set both the same.
 */
export function guestCoopEnabled(): boolean {
  const v = process.env.GUEST_COOP?.trim().toLowerCase()
  return !(v === 'false' || v === '0' || v === 'no')
}
