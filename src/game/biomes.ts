export type Biome =
  | 'jungle' | 'desert' | 'ocean' | 'autumn' | 'arctic'
  | 'canyon' | 'swamp' | 'city' | 'volcano' | 'fortress'

export const BIOMES: Biome[] = ['jungle', 'desert', 'ocean', 'autumn', 'arctic', 'canyon', 'swamp', 'city', 'volcano', 'fortress']

export const isBiome = (v: string | null): v is Biome => !!v && (BIOMES as string[]).includes(v)
