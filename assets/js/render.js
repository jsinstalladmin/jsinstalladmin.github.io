/* ============================================================
   render.js — the photoreal pass.
   Scene units are INCHES (1 unit = 1 inch). Every radius, bias
   and falloff below is in inches; copying metre-scale values
   from tutorials is the usual reason this looks wrong.
   ============================================================ */
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const EDGE_R = 0.10;      /* 2.5 mm. Real edgebanding is ~1.5 mm, but at
   render scale a 1.5 mm radius is under a pixel on most edges, so every panel
   terminated in a razor line and the whole thing read as CAD. A slightly
   generous radius gives each edge a highlight to catch, which is most of what
   separates a render from a drawing. */
export const TEX_TILE_IN = 72.05;// oak_veneer_01 is 1830 mm square
export const SWATCH_TILE_IN = 32;// melamine decor repeats ~800 mm

/* ---------- renderer ---------- */
export function makeRenderer(canvas){
  const r = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance',
    /* render-on-demand idles the loop, so the drawing buffer MUST persist or the
       canvas blanks the moment the compositor needs a frame we did not draw. */
    preserveDrawingBuffer:true});
  /* 2x on a retina Mac is FOUR times the pixels to shade every frame, for a
     difference you cannot see on bevels this small. 1.5 is the honest cap. */
  r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  r.outputColorSpace = THREE.SRGBColorSpace;
  /* The single highest-value line here. three.js defaults to NoToneMapping, which
     hard-clips every specular highlight to flat white — most of the cartoon look.
     Neutral (Khronos PBR Neutral) is built for commerce viewers: it leaves
     mid-tones alone so a named finish still reads as that finish. */
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = 1.06;
  r.shadowMap.enabled = true;
  /* PCFShadowMap, NOT PCFSoftShadowMap: PCFSoft ignores shadow.radius entirely,
     so softness becomes unadjustable. */
  r.shadowMap.type = THREE.PCFShadowMap;
  r.shadowMap.autoUpdate = false;       // geometry only changes on user input
  THREE.Texture.DEFAULT_ANISOTROPY = Math.min(8, r.capabilities.getMaxAnisotropy());
  return r;
}

/* ---------- lighting: IBL does the ambient, one key gives direction ---------- */
export function setupLighting(scene, renderer){
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  // instant, zero-download
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 1.12;

  /* Without a background the composer clears to black and the room floats in a void. */
  scene.background = new THREE.Color(0xE9E6E1);

  /* Three-point, not one. A single key gave every vertical panel the same flat
     value, which is why the cabinetry looked drawn rather than lit. */
  const key = new THREE.DirectionalLight(0xfffaf3, 1.55);
  key.position.set(110, 200, 190);
  key.castShadow = true;
  key.shadow.mapSize.set(2560, 2560);   // 2048 stair-stepped on the toe kick; 3072 is needlessly heavy
  key.shadow.radius = 5;
  key.shadow.intensity = 0.58;   // with real IBL a full-strength shadow double-darkens
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.16;  // 4 mm — under the 0.375" half-panel leak threshold
  scene.add(key);

  /* cool bounce from the opposite side, so shadowed faces separate from each
     other instead of going to one dead tone */
  const fill = new THREE.DirectionalLight(0xdfe8f2, 0.34);
  fill.position.set(-170, 90, 120);
  scene.add(fill);

  /* a low warm rim that grazes the front edges and lights the bevels */
  const rim = new THREE.DirectionalLight(0xffeedd, 0.30);
  rim.position.set(-40, 50, -150);
  scene.add(rim);

  // upgrade to the real room HDRI in the background
  // upgrade to the real room HDRI in the background
  new RGBELoader().load((window.BASE||"")+'assets/hdr/lythwood_room_1k.hdr', hdr=>{
    const rt = pmrem.fromEquirectangular(hdr);
    hdr.dispose();
    scene.environment = rt.texture;
    scene.environmentRotation.y = Math.PI * 0.22;
    onEnvReady && onEnvReady();
  }, undefined, ()=>{ /* keep RoomEnvironment */ });

  let onEnvReady = null;
  return { key, pmrem, onReady:fn=>{onEnvReady=fn} };
}

export function fitShadowCamera(key, root){
  const box = new THREE.Box3().setFromObject(root);
  if(box.isEmpty()) return;
  const s = box.getBoundingSphere(new THREE.Sphere());
  const c = key.shadow.camera;
  c.left=-s.radius-24; c.right=s.radius+24; c.top=s.radius+24; c.bottom=-s.radius-24;
  c.near=10; c.far=Math.max(400, s.radius*4);
  c.updateProjectionMatrix();
}

/* ---------- shared PBR maps: one grain topography, 78 albedos ---------- */
export function loadSharedMaps(){
  const L = new THREE.TextureLoader();
  const data = u => { const t=L.load(u); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t; }; // NoColorSpace
  return { nor:data((window.BASE||"")+'assets/tex/oak_nor.jpg'), arm:data((window.BASE||"")+'assets/tex/oak_arm.jpg') };
}

/* ---------- bevelled panel geometry, cached by quantised size ---------- */
const geoCache = new Map();
export function panelGeo(w,h,d){
  const q = v => Math.max(0.1, Math.round(v*16)/16);      // 1/16"
  const W=q(w), H=q(h), D=q(d);
  const k = `${W}|${H}|${D}`;
  let g = geoCache.get(k);
  if(!g){
    const r = Math.min(EDGE_R, W/2.05, H/2.05, D/2.05);
    g = new RoundedBoxGeometry(W,H,D,2,r);                // 2 segments so the edge has a gradient, not a facet
    geoCache.set(k,g);
    if(geoCache.size > 400){                              // evict oldest
      const first = geoCache.keys().next().value;
      geoCache.get(first).dispose(); geoCache.delete(first);
    }
  }
  return g;
}

/* ---------- composer: GTAO is what makes a carcass interior read as occluded ---------- */
export function makeComposer(renderer, scene, cam, w, h){
  try{
    const composer = new EffectComposer(renderer);
    /* GTAOPass.OUTPUT.Default copies readBuffer.texture as the beauty — it does NOT
       render the scene itself, so a RenderPass must fill that buffer first. */
    composer.addPass(new RenderPass(scene, cam));
    const ao = new GTAOPass(scene, cam, w, h);
    ao.output = GTAOPass.OUTPUT.Default;
    ao.blendIntensity = 1.25;
    ao.updateGtaoMaterial({ radius:9.0, distanceExponent:1.0, thickness:1.0,
      scale:1.1, samples:8, distanceFallOff:1.0, screenSpaceRadius:false });   // 16 -> 8: half the AO cost, no visible difference at this scale
    composer.addPass(ao);
    composer.addPass(new SMAAPass(w,h));   // EffectComposer has no MSAA; antialias:true is a no-op here
    composer.addPass(new OutputPass());    // applies toneMapping + outputColorSpace. ALWAYS last.
    return { composer, ao };
  }catch(e){
    console.warn('[render] post-processing unavailable, falling back to direct render', e);
    return { composer:null, ao:null };
  }
}
