import * as THREE from 'three'

/** A material's own glow, kept so a hit flash can put it back. */
export type Look = { emissive: THREE.Color; intensity: number; map: THREE.Texture | null }

export function captureLooks(mats: THREE.MeshStandardMaterial[]): Look[] {
  return mats.map((m) => ({ emissive: m.emissive.clone(), intensity: m.emissiveIntensity, map: m.emissiveMap }))
}

const setMap = (m: THREE.MeshStandardMaterial, map: THREE.Texture | null) => {
  // Adding or removing a map changes the shader; same map, no recompile
  if (m.emissiveMap === map) return
  m.emissiveMap = map
  m.needsUpdate = true
}

/**
 * Hit flash: the whole craft glows white. An emissive map would limit the glow to the lights, so it
 * comes off while flashing and goes back after.
 */
export function applyFlash(mats: THREE.MeshStandardMaterial[], looks: Look[], on: boolean, intensity: number) {
  mats.forEach((m, i) => {
    const look = looks[i]
    if (!look) return
    if (on) {
      setMap(m, null)
      m.emissive.set('#ffffff')
      m.emissiveIntensity = intensity
    } else {
      setMap(m, look.map)
      m.emissive.copy(look.emissive)
      m.emissiveIntensity = look.intensity
    }
  })
}

/** A locked plane in the hangar: one flat dark color, no texture, no glow. */
export function applySilhouette(mat: THREE.MeshStandardMaterial, color: string) {
  mat.map = null
  mat.emissiveMap = null
  mat.color.set(color)
  mat.emissive.set('#000000')
  mat.needsUpdate = true
}
