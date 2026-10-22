// Effect shaders. All draw on a unit quad lying flat in XZ (the camera looks straight down), skip tone
// mapping (bright values feed the bloom) and never write depth. Each has a `uTime` its owner sets per frame.
import * as THREE from 'three'
import { boltQuad } from '../../../game/fx/bulletLook'

/** The unit quad every effect draws on: XZ in [−0.5, 0.5], facing up. */
export const fxQuad = () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)

const NOISE = /* glsl */ `
float fxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fxNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fxHash(i), fxHash(i + vec2(1.0, 0.0)), f.x), mix(fxHash(i + vec2(0.0, 1.0)), fxHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`

/**
 * Pool particles: per instance iPos, iVel, iCol (rgb, alpha0) and iMisc (age, life, size0, size1).
 * vUv is (0..1, 0..1) across the quad with y = 1 at its +Z edge; vT is age over life.
 */
const PARTICLE_VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec3 iVel;
attribute vec4 iCol;
attribute vec4 iMisc;
uniform float uTime;
varying vec2 vUv;
varying vec4 vCol;
varying float vT;
varying float vSeed;
void main() {
  float t = clamp(iMisc.x / max(iMisc.y, 1e-4), 0.0, 1.0);
  float grow = 1.0 - (1.0 - t) * (1.0 - t);
  float size = mix(iMisc.z, iMisc.w, grow);
  vec2 q = position.xz;
#ifdef STRETCH
  // A streak behind the particle along its velocity, longer the faster it flies
  vec2 v = iVel.xz;
  float speed = length(v);
  vec2 dir = speed > 1e-3 ? v / speed : vec2(0.0, 1.0);
  vec2 side = vec2(dir.y, -dir.x);
  float len = size * 1.5 + speed * 0.035;
  vec2 xz = iPos.xz + side * q.x * size + dir * (q.y - 0.5) * len;
#else
  vec2 xz = iPos.xz + q * size * SIZE_SCALE;
#endif
  vUv = q + 0.5;
  vCol = iCol;
  vT = t;
  vSeed = fract(iMisc.y * 7.13 + iMisc.z * 3.71);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(xz.x, iPos.y, xz.y, 1.0);
}`

function particleMaterial(frag: string, opts: { additive: boolean; defines?: Record<string, string | number>; uniforms?: Record<string, THREE.IUniform> }) {
  return new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERT,
    fragmentShader: frag,
    uniforms: { uTime: { value: 0 }, ...opts.uniforms },
    defines: { SIZE_SCALE: '1.0', ...opts.defines },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  })
}

/** Additive soft glow with a hot centre that cools with age: fire, flashes. `noise` breaks up the disc. */
export function glowMaterial({ noise = 0 }: { noise?: number } = {}) {
  return particleMaterial(/* glsl */ `
    uniform float uTime;
    uniform float uNoise;
    varying vec2 vUv;
    varying vec4 vCol;
    varying float vT;
    varying float vSeed;
    ${NOISE}
    void main() {
      vec2 p = vUv - 0.5;
      float n = fxNoise(p * 4.0 + vSeed * 23.0 + vec2(0.0, uTime * 1.5));
      float d = length(p) * 2.0 + (n - 0.5) * uNoise;
      if (d > 1.0) discard;
      float fall = (1.0 - d) * (1.0 - d);
      float core = (1.0 - smoothstep(0.0, 0.5, d)) * (1.0 - vT) * (1.0 - vT);
      vec3 c = mix(vCol.rgb, vCol.rgb * vec3(0.9, 0.4, 0.25), vT) * fall + vec3(1.0, 0.85, 0.6) * core * 0.45;
      float fade = 1.0 - vT;
      gl_FragColor = vec4(c, fade * vCol.a);
      #include <colorspace_fragment>
    }`, { additive: true, uniforms: { uNoise: { value: noise } } })
}

/**
 * Normal-blended noisy puff that darkens, grows and fades; warm for its first moments, as if lit by
 * the fire. `hard` makes small solid chunks instead (debris).
 */
export function smokeMaterial({ hard = false }: { hard?: boolean } = {}) {
  return particleMaterial(/* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    varying vec4 vCol;
    varying float vT;
    varying float vSeed;
    ${NOISE}
    void main() {
      vec2 p = vUv - 0.5;
      float m = fxNoise(p * 3.0 + vSeed * 17.0 + vec2(0.0, uTime * 0.15)) * 0.65 + fxNoise(p * 6.5 - vSeed * 11.0) * 0.35;
      float d = length(p) * 2.0;
    #ifdef HARD
      float shape = 1.0 - smoothstep(0.6, 0.8, d + (m - 0.5) * 0.5);
      float alpha = shape * vCol.a * (1.0 - vT * vT * vT);
      vec3 c = vCol.rgb * (0.7 + 0.6 * m);
    #else
      float shape = 1.0 - smoothstep(0.25, 1.0, d + (m - 0.5) * 0.6);
      // Holds its density for the first half of its life, then thins away
      float alpha = shape * vCol.a * (1.0 - smoothstep(0.4, 1.0, vT)) * smoothstep(0.0, 0.08, vT);
      vec3 c = vCol.rgb * (0.75 + 0.5 * m) * mix(1.0, 0.65, vT) + vec3(0.55, 0.22, 0.05) * (1.0 - smoothstep(0.0, 0.22, vT));
    #endif
      if (alpha < 0.004) discard;
      gl_FragColor = vec4(c, alpha);
      #include <colorspace_fragment>
    }`, { additive: false, defines: hard ? { HARD: 1 } : {} })
}

/** Additive soft annulus; size0 and size1 are its start and end radius. */
export function ringMaterial() {
  return particleMaterial(/* glsl */ `
    varying vec2 vUv;
    varying vec4 vCol;
    varying float vT;
    void main() {
      float d = length(vUv - 0.5) * 2.0;
      if (d > 1.0) discard;
      float w = mix(0.22, 0.07, vT);
      float band = 1.0 - smoothstep(0.0, w, abs(d - (1.0 - w)));
      float inner = (1.0 - d) * 0.12;
      float fade = (1.0 - vT) * (1.0 - vT);
      gl_FragColor = vec4(vCol.rgb * (band + inner), fade * vCol.a);
      #include <colorspace_fragment>
    }`, { additive: true, defines: { SIZE_SCALE: '2.0' } })
}

/** Additive short streak stretched along its velocity: sparks. size0/size1 are its width. */
export function sparkMaterial() {
  return particleMaterial(/* glsl */ `
    varying vec2 vUv;
    varying vec4 vCol;
    varying float vT;
    void main() {
      float across = abs(vUv.x - 0.5) * 2.0;
      float a = (1.0 - smoothstep(0.25, 1.0, across)) * smoothstep(0.0, 0.8, vUv.y);
      vec3 c = mix(vCol.rgb, vec3(2.2), 0.4 * (1.0 - across) * vUv.y);
      gl_FragColor = vec4(c * a, (1.0 - vT) * vCol.a);
      #include <colorspace_fragment>
    }`, { additive: true, defines: { STRETCH: 1 } })
}

/** A quad placed by instanceMatrix, tinted by instanceColor when the mesh has one. */
const INSTANCED_VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  // (0..1) across the quad, y = 1 at its +Z edge; from uv, so a pre-scaled geometry keeps it
  vUv = vec2(uv.x, 1.0 - uv.y);
  vec4 p = vec4(position, 1.0);
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
#endif
#ifdef USE_INSTANCING_COLOR
  vColor = instanceColor;
#else
  vColor = vec3(1.0);
#endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`

/**
 * Additive round glow placed by instanceMatrix: bullet halos and cores, missile glows, muzzle flashes.
 * Solid out to `body` (a fraction of the radius), then a soft falloff; `hot` adds a white centre and
 * `star` four rays. Colour × instanceColor.
 */
export function spriteMaterial({ color = '#ffffff', intensity = 1, body = 0, hot = 0, star = false }: { color?: THREE.ColorRepresentation; intensity?: number; body?: number; hot?: number; star?: boolean } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: INSTANCED_VERT,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uBody;
      uniform float uHot;
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        vec2 p = vUv - 0.5;
        float d = length(p) * 2.0;
        if (d > 1.0) discard;
        float soft = 1.0 - max(d - uBody, 0.0) / max(1.0 - uBody, 1e-3);
        float a = soft * soft;
      #ifdef STAR
        float ang = atan(p.y, p.x);
        float rays = pow(abs(cos(ang * 2.0)), 24.0) * (1.0 - d);
        a = max(a * (1.0 - smoothstep(0.15, 0.6, d)), rays);
      #endif
        float hot = (1.0 - smoothstep(0.0, 0.45, d)) * uHot;
        gl_FragColor = vec4(uColor * vColor * a * uIntensity + vec3(hot), 1.0);
        #include <colorspace_fragment>
      }`,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uBody: { value: body },
      uHot: { value: hot },
    },
    defines: star ? { STAR: 1 } : {},
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
}

/**
 * Additive plasma bolt on an InstancedMesh (instanceMatrix + instanceColor): a capsule with a white-hot
 * core and a halo in the instance colour at the hit point, and a tail fading toward the quad's −Z end.
 * The quad is scaled to `boltQuad`: the hit point sits `back` from its −Z end.
 */
export function streakMaterial() {
  const q = boltQuad(1)
  return new THREE.ShaderMaterial({
    vertexShader: INSTANCED_VERT,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uHead;
      uniform float uAspect;
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        // In quad widths, from the hit point; +y toward the tip
        vec2 p = vec2(vUv.x - 0.5, (vUv.y - uHead) * uAspect);
        float seg = clamp(p.y, -0.55, 0.0);
        float d = length(vec2(p.x, p.y - seg));
        float core = 1.0 - smoothstep(0.1, 0.17, d);
        float halo = exp(-d * d * 16.0);
        float tailLen = max(uHead * uAspect - 0.55, 1e-3);
        float k = clamp((-p.y - 0.55) / tailLen, 0.0, 1.0);
        float tw = mix(0.17, 0.03, k);
        float tail = step(p.y, -0.55) * (1.0 - k) * (1.0 - k) * exp(-(p.x * p.x) / (tw * tw));
        float edge = 1.0 - smoothstep(0.4, 0.5, abs(p.x));
        vec3 c = vColor * (halo * 1.8 + tail * 1.2) + vec3(1.0) * core * 2.2;
        gl_FragColor = vec4(c * edge, 1.0);
        #include <colorspace_fragment>
      }`,
    uniforms: {
      uTime: { value: 0 },
      uHead: { value: q.back / (q.front + q.back) },
      uAspect: { value: (q.front + q.back) / q.width },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
}

/** A plain quad (no instancing): vUv (0..1) with vUv.y = 1 at the quad's +Z edge. */
const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = vec2(uv.x, 1.0 - uv.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

/**
 * Additive engine flame on a quad from the nozzle (+Z end) to the tail (−Z end): a white-hot core that
 * cools into `color`, narrowing and thinning to nothing at the tail, flickering with scrolling noise.
 */
export function flameMaterial({ color, core = '#ffffff' }: { color: THREE.ColorRepresentation; core?: THREE.ColorRepresentation }) {
  return new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uSeed;
      uniform vec3 uColor;
      uniform vec3 uCore;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        float u = 1.0 - vUv.y;               // 0 at the nozzle, 1 at the tail
        float v = abs(vUv.x - 0.5) * 2.0;    // 0 on the axis, 1 at the edge
        float n = fxNoise(vec2(vUv.x * 3.0 + uSeed, u * 5.0 - uTime * 14.0));
        float w = mix(0.95, 0.12, u) * (0.85 + 0.3 * n);
        float body = 1.0 - smoothstep(w * 0.45, w, v);
        float fade = pow(1.0 - u, 1.4);
        float hot = (1.0 - smoothstep(0.0, w * 0.45, v)) * (1.0 - smoothstep(0.0, 0.55, u));
        vec3 c = uColor * body * fade * 1.6 + uCore * hot * 1.4;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: Math.random() * 50 },
      uColor: { value: new THREE.Color(color) },
      uCore: { value: new THREE.Color(core) },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
}

/**
 * Additive boss laser on a quad from the muzzle (−Z end) out along +Z: a soft outer glow in `color`, a
 * white-hot core and a flicker running along its length. `uOpen` (0..1) opens and pinches its width.
 */
export function beamMaterial({ color }: { color: THREE.ColorRepresentation }) {
  return new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpen;
      uniform float uLength;
      uniform vec3 uColor;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        float along = vUv.y * uLength;       // units from the muzzle
        float v = abs(vUv.x - 0.5) * 2.0 / max(uOpen, 1e-3);
        if (v > 1.0) discard;
        float n = fxNoise(vec2(along * 0.6 - uTime * 30.0, vUv.x * 4.0));
        float n2 = fxNoise(vec2(along * 2.3 - uTime * 55.0, 7.0));
        float glow = exp(-v * v * 5.0) * (0.75 + 0.35 * n);
        float core = (1.0 - smoothstep(0.12, 0.26 + 0.06 * n2, v));
        // Bright where it leaves the muzzle
        float start = smoothstep(0.0, 0.4, along) * (1.0 + 1.2 * exp(-along * 0.8));
        vec3 c = (uColor * glow * 2.0 + vec3(1.0) * core * 2.2) * start;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    uniforms: {
      uTime: { value: 0 },
      uOpen: { value: 1 },
      uLength: { value: 1 },
      uColor: { value: new THREE.Color(color) },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
}

/** Ripple slots a shield draws: (x, z) on the bubble in radii from its centre, and age; age < 0 is empty. */
export const SHIELD_RIPPLES = 4

/**
 * Additive energy bubble seen from above, on a quad 2 radii across: faint inside, bright at its rim (a
 * fresnel on the radius), a slow shimmer, and up to SHIELD_RIPPLES rings spreading from blocked hits.
 */
export function shieldMaterial({ color = '#4fc3f7', rim = '#9be7ff', rippleLife }: { color?: THREE.ColorRepresentation; rim?: THREE.ColorRepresentation; rippleLife: number }) {
  return new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uRim;
      uniform vec3 uRipples[${SHIELD_RIPPLES}];
      uniform float uRippleLife;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;
        float edge = 1.0 - smoothstep(0.93, 1.0, r);
        float fres = pow(r, 5.0);
        float shimmer = fxNoise(p * 3.0 + vec2(uTime * 0.7, -uTime * 0.5));
        float a = (0.07 + 0.05 * shimmer) + fres * 0.85;
        float ring = 0.0;
        for (int i = 0; i < ${SHIELD_RIPPLES}; i++) {
          vec3 q = uRipples[i];
          if (q.z < 0.0) continue;
          float k = q.z / uRippleLife;
          float d = distance(p, q.xy);
          float band = exp(-pow((d - k * 1.1) / 0.09, 2.0));
          ring += band * (1.0 - k) * (1.0 - k);
        }
        vec3 c = uColor * a + uRim * (fres * 0.6 + ring * 1.6);
        gl_FragColor = vec4(c * edge, 1.0);
        #include <colorspace_fragment>
      }`,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uRim: { value: new THREE.Color(rim) },
      uRipples: { value: Array.from({ length: SHIELD_RIPPLES }, () => new THREE.Vector3(0, 0, -1)) },
      uRippleLife: { value: rippleLife },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
}
