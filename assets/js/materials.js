/* ============================================================
   materials.js — one shared grain topography, 78 albedos.
   Colour-space rules matter here and are the usual silent bug:
     albedo  -> SRGBColorSpace   (it is a photograph of colour)
     normal / roughness / AO -> leave default NoColorSpace (vectors + scalars)
   ============================================================ */
import * as THREE from 'three';
import { SWATCH_TILE_IN } from './render.js?v=19035fa4';

let SHEET = null, COLS = 8, ROWS = 7, TILE = 160;
const sliced = new Map();     // finish name -> CanvasTexture (sliced ONCE, not cloned)
const matCache = new Map();

/* Pre-slice the sprite sheet. Texture.clone() shares .image but three keys GPU
   state off the instance, so 78 clones = 78 full-sheet uploads. */
export function initSheet(img, meta){
  SHEET = img; COLS = meta.cols; ROWS = meta.rows; TILE = meta.tile || 160;
}

function albedoFor(f){
  if(f.x < 0 || !SHEET) return null;
  const key = f.n;
  if(sliced.has(key)) return sliced.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  const g = c.getContext('2d');
  const sw = SHEET.naturalWidth / COLS, sh = SHEET.naturalHeight / ROWS;
  g.drawImage(SHEET, f.x*sw, f.y*sh, sw, sh, 0, 0, TILE, TILE);
  const t = new THREE.CanvasTexture(c);
  /* Mirrored, not Repeat: the 160px crops don't tile seamlessly, and on woodgrain
     a mirrored seam reads as book-matched veneer — which is a real, premium thing. */
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  sliced.set(key, t);
  return t;
}

/* average luminance of a swatch -> per-finish sheen character, and a fallback colour */
function swatchStats(f){
  const t = albedoFor(f);
  if(!t) return { lum:0.72, hex:0xC9BBA8 };
  const c = t.image, g = c.getContext('2d');
  const d = g.getImageData(0,0,c.width,c.height).data;
  let r=0,gr=0,b=0,n=0;
  for(let i=0;i<d.length;i+=16){ r+=d[i]; gr+=d[i+1]; b+=d[i+2]; n++; }
  r/=n; gr/=n; b/=n;
  return { lum:(0.2126*r+0.7152*gr+0.0722*b)/255,
           hex:(Math.round(r)<<16)|(Math.round(gr)<<8)|Math.round(b) };
}

export function finishMaterial(f, shared, kind='carcass'){
  const key = f.n+'|'+kind;
  if(matCache.has(key)) return matCache.get(key);
  const { lum, hex } = swatchStats(f);
  const gloss = f.lv >= 5;

  const m = new THREE.MeshStandardMaterial({
    color: albedoFor(f) ? 0xffffff : new THREE.Color(hex),
    map: albedoFor(f),
    normalMap: shared.nor,
    // melamine is nearly flat — full-strength wood normals read as rough-sawn timber
    normalScale: new THREE.Vector2(gloss?0.08:0.20, gloss?0.08:0.20),
    roughnessMap: shared.arm,
    metalnessMap: shared.arm,
    aoMap: shared.arm,
    aoMapIntensity: 0.55,
    // lighter decors run slightly glossier; gives each finish its own sheen for free
    roughness: gloss ? 0.14 : (0.70 - 0.12*lum),
    metalness: 0.0,                 // dielectric. Any non-zero value just eats diffuse.
    envMapIntensity: gloss ? 1.25 : 1.0
  });
  if(kind==='front') m.roughness = Math.max(0.08, m.roughness - 0.04);
  matCache.set(key, m);
  return m;
}

/* Scale the grain to the REAL panel size so a tall panel and a short shelf share
   one grain scale. Tiling every panel 1:1 regardless of size is what makes a
   configurator look like a diagram. */
export function scaledMaterial(base, w, h, shared, seed=0){
  const m = base.clone();
  const fit = (src, tileIn) => {
    if(!src) return null;
    const t = src.clone(); t.needsUpdate = true;
    t.wrapS = src.wrapS; t.wrapT = src.wrapT;
    t.colorSpace = src.colorSpace;
    t.repeat.set(Math.max(0.08, w/tileIn), Math.max(0.08, h/tileIn));
    t.offset.set((seed*0.137)%1, (seed*0.419)%1);   // break the marching grain pattern
    return t;
  };
  if(base.map)       m.map       = fit(base.map, SWATCH_TILE_IN);
  if(base.normalMap) m.normalMap = fit(base.normalMap, 72.05);
  if(base.roughnessMap){
    const a = fit(base.roughnessMap, 72.05);
    m.roughnessMap = m.metalnessMap = m.aoMap = a;
  }
  m.roughness = THREE.MathUtils.clamp(base.roughness + ((seed%7)-3)*0.008, 0.05, 0.95);
  return m;
}

export const hardwareMaterial = () => new THREE.MeshPhysicalMaterial({
  color: 0xC2C6C9, metalness: 1.0, roughness: 0.24,
  anisotropy: 0.6, anisotropyRotation: Math.PI/2,   // brushed nickel
  clearcoat: 0.25, clearcoatRoughness: 0.3, envMapIntensity: 1.4
});

export const clothMaterials = () => [0x6E7A88,0x8C8378,0x4E5560,0x9AA0A6,0x77705F,0x5C6670]
  .map(c=>new THREE.MeshStandardMaterial({color:c, roughness:0.96, metalness:0}));

export const clearCaches = () => { matCache.clear(); };
