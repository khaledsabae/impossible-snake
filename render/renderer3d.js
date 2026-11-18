// Cinematic 3D WebGL engine (Three.js) composited with crisp 2D HUD overlays.
// Stateless and deterministic: every frame is derived strictly from `(frame, ms)`
// so both Playwright video capture seeking and the live browser game render identically.

import * as THREE from '../vendor/three.module.js';
import { Game } from '../core/game.js';
import { stageFromLog, NO_KEYS } from './renderer.js';
import { makeKeycapGeometry, makeAppleBodyGeometry, makeAppleLeafGeometry } from './blender-meshes.js';

export const BIOMES_3D = {
  alabaster: {
    key: 'alabaster',
    name: 'ALABASTER STUDIO',
    light: true,
    bgTop: '#f3f7fc',
    bgMid: '#dde7f3',
    bgBot: '#b8cbe0',
    plinthColor: 0x334155,
    slabColor: 0xf8fafc,
    frameColor: 0x059669,
    wrapFrameColor: 0x0284c7,
    tileA: 0xe6eef8,
    tileB: 0xd7e3f2,
    obstacleBase: 0x1e293b,
    obstacleCap: 0x475569,
    obstacleEmissive: 0x0f172a,
    snakeHead: 0x34d399,
    snakeA: 0x10b981,
    snakeMid: 0x0284c7,
    snakeB: 0x1e3a8a,
    appleColor: 0xef4444,
    goldenColor: 0xf59e0b,
    moverColor: 0x0ea5e9,
    hudCard: 'rgba(15, 23, 42, 0.88)',
    hudBorder: 'rgba(16, 185, 129, 0.55)',
    hudText: '#f8fafc',
    hudMuted: '#cbd5e1',
    accentCss: '#10b981',
    accentBrightCss: '#34d399',
    goldCss: '#fbbf24',
    dangerCss: '#fb7185',
    skyLight: 0xffffff,
    groundLight: 0x94a3b8,
    ambientIntensity: 0.92,
    keyIntensity: 1.55,
  },
  glacier: {
    key: 'glacier',
    name: 'GLACIER VAULT',
    light: true,
    bgTop: '#ecfeff',
    bgMid: '#bae6fd',
    bgBot: '#7dd3fc',
    plinthColor: 0x0f172a,
    slabColor: 0xf0f9ff,
    frameColor: 0x06b6d4,
    wrapFrameColor: 0x0284c7,
    tileA: 0xe0f2fe,
    tileB: 0xcbeafe,
    obstacleBase: 0x0c4a6e,
    obstacleCap: 0x38bdf8,
    obstacleEmissive: 0x082f49,
    snakeHead: 0xfda4af,
    snakeA: 0xf43f5e,
    snakeMid: 0x9333ea,
    snakeB: 0x312e81,
    appleColor: 0xf59e0b,
    goldenColor: 0xfbbf24,
    moverColor: 0x06b6d4,
    hudCard: 'rgba(12, 24, 44, 0.90)',
    hudBorder: 'rgba(56, 189, 248, 0.60)',
    hudText: '#f8fafc',
    hudMuted: '#bae6fd',
    accentCss: '#f43f5e',
    accentBrightCss: '#fb7185',
    goldCss: '#fbbf24',
    dangerCss: '#ef4444',
    skyLight: 0xf0f9ff,
    groundLight: 0x64748b,
    ambientIntensity: 0.95,
    keyIntensity: 1.5,
  },
  obsidian: {
    key: 'obsidian',
    name: 'OBSIDIAN FORGE',
    light: false,
    bgTop: '#1e293b',
    bgMid: '#131d2e',
    bgBot: '#090e18',
    plinthColor: 0x0b111d,
    slabColor: 0x1e293b,
    frameColor: 0xf59e0b,
    wrapFrameColor: 0x06b6d4,
    tileA: 0x293548,
    tileB: 0x202b3c,
    obstacleBase: 0x0f172a,
    obstacleCap: 0xf59e0b,
    obstacleEmissive: 0x332200,
    snakeHead: 0xfef08a,
    snakeA: 0xf59e0b,
    snakeMid: 0xea580c,
    snakeB: 0x7c2d12,
    appleColor: 0x10b981,
    goldenColor: 0xfef08a,
    moverColor: 0x38bdf8,
    hudCard: 'rgba(9, 14, 24, 0.90)',
    hudBorder: 'rgba(245, 158, 11, 0.65)',
    hudText: '#f8fafc',
    hudMuted: '#94a3b8',
    accentCss: '#f59e0b',
    accentBrightCss: '#fcd34d',
    goldCss: '#fde047',
    dangerCss: '#fb7185',
    skyLight: 0xe2e8f0,
    groundLight: 0x334155,
    ambientIntensity: 0.85,
    keyIntensity: 1.75,
  },
  sunset: {
    key: 'sunset',
    name: 'CYBER SANCTUARY',
    light: false,
    bgTop: '#4a1d5a',
    bgMid: '#2a153d',
    bgBot: '#130b20',
    plinthColor: 0x160d24,
    slabColor: 0x261a3b,
    frameColor: 0xd946ef,
    wrapFrameColor: 0x00f5d4,
    tileA: 0x362452,
    tileB: 0x2b1c42,
    obstacleBase: 0x170f26,
    obstacleCap: 0xe879f9,
    obstacleEmissive: 0x3b0764,
    snakeHead: 0x67e8f9,
    snakeA: 0xe879f9,
    snakeMid: 0x9333ea,
    snakeB: 0x3b0764,
    appleColor: 0x00f5d4,
    goldenColor: 0xfbbf24,
    moverColor: 0x00f5d4,
    hudCard: 'rgba(18, 10, 32, 0.90)',
    hudBorder: 'rgba(217, 70, 239, 0.65)',
    hudText: '#fdf4ff',
    hudMuted: '#d8b4fe',
    accentCss: '#e879f9',
    accentBrightCss: '#f0abfc',
    goldCss: '#fbbf24',
    dangerCss: '#fb7185',
    skyLight: 0xfce7f3,
    groundLight: 0x4c1d95,
    ambientIntensity: 0.88,
    keyIntensity: 1.75,
  },
};

export const STAGE_BIOME = {
  1: 'alabaster',
  2: 'glacier',
  3: 'alabaster',
  4: 'obsidian',
  5: 'sunset',
  6: 'glacier',
  7: 'alabaster',
  8: 'obsidian',
  9: 'sunset',
};

function makeRoundedPillGeometry(w = 0.82, h = 0.56, d = 0.82, r = 0.17, bevel = 0.09) {
  const hw = w / 2 - bevel;
  const hd = d / 2 - bevel;
  const rr = Math.min(r, hw * 0.8, hd * 0.8);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + rr, -hd);
  shape.lineTo(hw - rr, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + rr);
  shape.lineTo(hw, hd - rr);
  shape.quadraticCurveTo(hw, hd, hw - rr, hd);
  shape.lineTo(-hw + rr, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - rr);
  shape.lineTo(-hw, -hd + rr);
  shape.quadraticCurveTo(-hw, -hd, -hw + rr, -hd);

  const extrudeH = Math.max(0.05, h - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeH,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -extrudeH / 2, 0);
  geo.computeVertexNormals();
  return geo;
}

function hash01(seed) {
  let x = (seed ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Shared 3D board & snake painter driving both offline video capture and live play.
 */
export class Painter3D {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} meta   stage/run metadata (width, height, obstacles, movers, capacity, biome...)
   */
  constructor(canvas, meta) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.m = meta;
    const stageId = meta.stage || meta.id || 1;
    const biomeKey = meta.biome && BIOMES_3D[meta.biome]
      ? meta.biome
      : (STAGE_BIOME[stageId] || 'alabaster');
    this.biome = BIOMES_3D[biomeKey];
    this._obsSet = new Set(meta.obstacles || []);
    this._disposed = false;

    this._tmpObj = new THREE.Object3D();
    this._tmpColor = new THREE.Color();
    this._projVec = new THREE.Vector3();
    this._cHeadColor = new THREE.Color(this.biome.snakeHead);
    this._cA = new THREE.Color();
    this._cMid = new THREE.Color();
    this._cB = new THREE.Color();
    this._cGold = new THREE.Color(this.biome.goldenColor);
    this._cDanger = new THREE.Color(0xef4444);
    this._envRT = null;

    this._bgImg = null;
    this._bgReady = Promise.resolve();
    if (typeof Image !== 'undefined') {
      this._bgImg = new Image();
      this._bgReady = new Promise((resolve) => {
        this._bgImg.onload = () => resolve();
        this._bgImg.onerror = () => resolve();
      });
      this._bgImg.src = new URL(`./assets/backdrops/${this.biome.key}.jpg`, import.meta.url).href;
    }

    this._bloomCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    this._bloomCtx = this._bloomCanvas ? this._bloomCanvas.getContext('2d') : null;

    this.glCanvas = document.createElement('canvas');
    this.webgl = new THREE.WebGLRenderer({
      canvas: this.glCanvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.webgl.setClearColor(0x000000, 0);
    this.webgl.setPixelRatio(1);
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = THREE.PCFShadowMap;
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, canvas.width / Math.max(1, canvas.height), 0.5, 160);
    this._w = 0;
    this._h = 0;
    this._ensureSize(canvas.width, canvas.height);

    this._buildLights();
    this._buildArenaGeometry();
    this._buildPooledActors();
    this._buildKeycapCluster();
    this._updateCamera({}, canvas.width || 1080, canvas.height || 1920, 0, 0);
  }

  ready() {
    return this._bgReady;
  }

  _ensureSize(w, h) {
    if (this._w === w && this._h === h) return;
    this._w = w;
    this._h = h;
    this.glCanvas.width = w;
    this.glCanvas.height = h;
    this.webgl.setSize(w, h, false);
    if (this._bloomCanvas) {
      this._bloomCanvas.width = Math.max(1, w >> 3);
      this._bloomCanvas.height = Math.max(1, h >> 3);
    }
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  _cellX(c) { return (c % this.m.width) - (this.m.width - 1) * 0.5; }
  _cellZ(c) { return ((c / this.m.width) | 0) - (this.m.height - 1) * 0.5; }

  _buildLights() {
    const b = this.biome;

    // Procedural studio softboxes environment map for clearcoat reflections
    const pmrem = new THREE.PMREMGenerator(this.webgl);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(b.light ? 0x2a3342 : 0x0b101b);
    const addPanel = (col, x, y, z, rx, ry, rz, sx, sy) => {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(sx, sy),
        new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })
      );
      panel.position.set(x, y, z);
      panel.rotation.set(rx, ry, rz);
      envScene.add(panel);
    };
    addPanel(0xffffff, 0, 14, 2, Math.PI / 2, 0, 0, 18, 12);
    addPanel(b.wrapFrameColor, -12, 6, -4, 0, Math.PI / 2, 0, 14, 10);
    addPanel(b.goldenColor, 12, 6, 6, 0, -Math.PI / 2, 0, 12, 10);
    this._envRT = pmrem.fromScene(envScene, 0.04);
    this.scene.environment = this._envRT.texture;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(b.skyLight, b.groundLight, b.ambientIntensity);
    this.scene.add(hemi);

    const span = Math.max(this.m.width, this.m.height) * 0.72;
    const key = new THREE.DirectionalLight(0xffffff, b.keyIntensity);
    key.position.set(8.5, 18.0, 10.5);
    key.castShadow = true;
    key.shadow.mapSize.set(768, 768);
    key.shadow.radius = 2;
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 52;
    key.shadow.camera.left = -(span + 2);
    key.shadow.camera.right = span + 2;
    key.shadow.camera.top = span + 2;
    key.shadow.camera.bottom = -(span + 7);
    key.shadow.bias = -0.0008;
    this.scene.add(key);
    this.keyLight = key;

    const rim = new THREE.DirectionalLight(b.wrapFrameColor, 0.55);
    rim.position.set(-10, 7, -11);
    this.scene.add(rim);

    const appleLight = new THREE.PointLight(b.appleColor, 1.4, 5.5, 1.5);
    appleLight.position.set(0, 1.0, 0);
    this.scene.add(appleLight);
    this.appleLight = appleLight;
  }

  _buildArenaGeometry() {
    const W = this.m.width;
    const H = this.m.height;
    const b = this.biome;

    // Studio floor shadow catcher covering both arena plinth and south macro-pad
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 24, H + 28),
      new THREE.ShadowMaterial({ opacity: b.light ? 0.22 : 0.40 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, -0.78, 2.0);
    shadowPlane.receiveShadow = true;
    this.scene.add(shadowPlane);

    // Lower stepped plinth
    const plinth = new THREE.Mesh(
      makeRoundedPillGeometry(W + 1.18, 0.52, H + 1.18, 0.45, 0.08),
      new THREE.MeshStandardMaterial({ color: b.plinthColor, roughness: 0.55, metalness: 0.25 })
    );
    plinth.position.y = -0.49;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.scene.add(plinth);

    // Upper ceramic/titanium board slab
    const slab = new THREE.Mesh(
      makeRoundedPillGeometry(W + 0.56, 0.32, H + 0.56, 0.32, 0.06),
      new THREE.MeshStandardMaterial({ color: b.slabColor, roughness: 0.36, metalness: b.light ? 0.08 : 0.32 })
    );
    slab.position.y = -0.22;
    slab.receiveShadow = true;
    this.scene.add(slab);

    // Perimeter accent trim bars (bright cyan along portal edges when wrap=true)
    const rimMat = new THREE.MeshStandardMaterial({
      color: this.m.wrap ? b.wrapFrameColor : b.frameColor,
      emissive: this.m.wrap ? b.wrapFrameColor : b.frameColor,
      emissiveIntensity: this.m.wrap ? 0.65 : 0.28,
      roughness: 0.25,
      metalness: 0.35,
    });
    this.rimMat = rimMat;
    const barThick = 0.11;
    const barH = 0.14;
    const north = new THREE.Mesh(new THREE.BoxGeometry(W + 0.42, barH, barThick), rimMat);
    north.position.set(0, -0.02, -(H / 2 + 0.17));
    const south = north.clone();
    south.position.z = H / 2 + 0.17;
    const west = new THREE.Mesh(new THREE.BoxGeometry(barThick, barH, H + 0.42), rimMat);
    west.position.set(-(W / 2 + 0.17), -0.02, 0);
    const east = west.clone();
    east.position.x = W / 2 + 0.17;
    this.scene.add(north, south, west, east);

    // Instanced checkerboard tiles for crisp grid readability
    const total = W * H;
    const tileGeo = makeRoundedPillGeometry(0.90, 0.12, 0.90, 0.13, 0.025);
    const tileMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: b.light ? 0.38 : 0.45,
      metalness: b.light ? 0.06 : 0.22,
    });
    this.tileMesh = new THREE.InstancedMesh(tileGeo, tileMat, total);
    this.tileMesh.receiveShadow = true;
    const o = this._tmpObj;
    for (let i = 0; i < total; i++) {
      const gx = i % W;
      const gy = (i / W) | 0;
      o.position.set(this._cellX(i), -0.04, this._cellZ(i));
      o.rotation.set(0, 0, 0);
      o.scale.set(this._obsSet.has(i) ? 0 : 1, this._obsSet.has(i) ? 0 : 1, this._obsSet.has(i) ? 0 : 1);
      o.updateMatrix();
      this.tileMesh.setMatrixAt(i, o.matrix);
      this._tmpColor.setHex(((gx + gy) & 1) ? b.tileA : b.tileB);
      this.tileMesh.setColorAt(i, this._tmpColor);
    }
    this.tileMesh.instanceMatrix.needsUpdate = true;
    this.tileMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.tileMesh);

    // Extruded 3D obstacle monoliths with beveled crowns
    const obs = this.m.obstacles || [];
    if (obs.length) {
      const baseGeo = makeRoundedPillGeometry(0.92, 0.86, 0.92, 0.14, 0.05);
      const baseMat = new THREE.MeshStandardMaterial({
        color: b.obstacleBase,
        emissive: b.obstacleEmissive,
        emissiveIntensity: 0.3,
        roughness: 0.35,
        metalness: 0.35,
      });
      const capGeo = makeRoundedPillGeometry(0.76, 0.10, 0.76, 0.10, 0.02);
      const capMat = new THREE.MeshStandardMaterial({
        color: b.obstacleCap,
        emissive: b.obstacleCap,
        emissiveIntensity: b.light ? 0.08 : 0.28,
        roughness: 0.22,
        metalness: 0.45,
      });
      const obsBase = new THREE.InstancedMesh(baseGeo, baseMat, obs.length);
      const obsCap = new THREE.InstancedMesh(capGeo, capMat, obs.length);
      obsBase.castShadow = true;
      obsBase.receiveShadow = true;
      obsCap.castShadow = true;
      for (let k = 0; k < obs.length; k++) {
        const c = obs[k];
        const x = this._cellX(c), z = this._cellZ(c);
        o.position.set(x, 0.41, z);
        o.rotation.set(0, 0, 0);
        o.scale.set(1, 1, 1);
        o.updateMatrix();
        obsBase.setMatrixAt(k, o.matrix);
        o.position.set(x, 0.88, z);
        o.updateMatrix();
        obsCap.setMatrixAt(k, o.matrix);
      }
      obsBase.instanceMatrix.needsUpdate = true;
      obsCap.instanceMatrix.needsUpdate = true;
      this.scene.add(obsBase, obsCap);
    }
  }

  _buildPooledActors() {
    const b = this.biome;
    const total = this.m.width * this.m.height;
    const maxSegs = total * 2 + 12;

    // Articulated glossy clearcoat snake body pool (segments + non-wrap capsule bridges)
    const segGeo = makeRoundedPillGeometry(0.76, 0.52, 0.76, 0.24, 0.085);
    const segMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.07,
    });
    this.snakeMesh = new THREE.InstancedMesh(segGeo, segMat, maxSegs);
    this.snakeMesh.castShadow = true;
    this.snakeMesh.receiveShadow = true;
    const o = this._tmpObj;
    o.scale.set(0, 0, 0);
    o.updateMatrix();
    for (let i = 0; i < maxSegs; i++) {
      this.snakeMesh.setMatrixAt(i, o.matrix);
      this.snakeMesh.setColorAt(i, this._cA.setHex(b.snakeA));
    }
    this.snakeMesh.instanceMatrix.needsUpdate = true;
    this.snakeMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.snakeMesh);

    // Expressive 3D head group + apple-tracking eyes
    this.headGroup = new THREE.Group();
    const headMesh = new THREE.Mesh(
      makeRoundedPillGeometry(0.84, 0.60, 0.84, 0.26, 0.095),
      new THREE.MeshPhysicalMaterial({
        color: b.snakeHead,
        roughness: 0.14,
        metalness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
      })
    );
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    this.headMesh = headMesh;
    this.headGroup.add(headMesh);

    const scleraGeo = new THREE.SphereGeometry(0.145, 14, 12);
    const scleraMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 });
    const pupilGeo = new THREE.SphereGeometry(0.082, 12, 10);
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x090d14, roughness: 0.1 });

    this.leftEye = new THREE.Mesh(scleraGeo, scleraMat);
    this.rightEye = new THREE.Mesh(scleraGeo, scleraMat);
    this.leftEye.position.set(0.20, 0.29, -0.22);
    this.rightEye.position.set(0.20, 0.29, 0.22);

    this.leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    this.rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    this.headGroup.add(this.leftEye, this.rightEye, this.leftPupil, this.rightPupil);
    this.scene.add(this.headGroup);

    // 3D Sculpted Apple + Leaf + Golden Star Halo + Floor Target Reticle
    this.appleGroup = new THREE.Group();
    this.normalAppleMesh = new THREE.Mesh(
      makeAppleBodyGeometry(THREE),
      new THREE.MeshPhysicalMaterial({
        color: b.appleColor,
        emissive: b.appleColor,
        emissiveIntensity: 0.34,
        roughness: 0.14,
        metalness: 0.16,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
      })
    );
    this.normalAppleMesh.castShadow = true;
    this.stemMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.048, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 })
    );
    this.stemMesh.position.set(0, 0.32, 0);
    this.leafMesh = new THREE.Mesh(
      makeAppleLeafGeometry(THREE),
      new THREE.MeshPhysicalMaterial({
        color: 0x22c55e,
        emissive: 0x15803d,
        emissiveIntensity: 0.22,
        roughness: 0.22,
        clearcoat: 0.8,
      })
    );
    this.leafMesh.castShadow = true;

    this.goldenAppleMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.40, 0),
      new THREE.MeshPhysicalMaterial({
        color: b.goldenColor,
        emissive: b.goldenColor,
        emissiveIntensity: 0.52,
        roughness: 0.14,
        metalness: 0.55,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
      })
    );
    this.goldenAppleMesh.castShadow = true;
    this.goldenRingMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.045, 10, 28),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: b.goldenColor,
        emissiveIntensity: 0.72,
        roughness: 0.2,
      })
    );
    this.goldenRingMesh.rotation.x = Math.PI / 2;
    this.appleGroup.add(this.normalAppleMesh, this.stemMesh, this.leafMesh, this.goldenAppleMesh, this.goldenRingMesh);
    this.scene.add(this.appleGroup);

    this.appleReticleMat = new THREE.MeshBasicMaterial({
      color: b.appleColor,
      transparent: true,
      opacity: 0.65,
    });
    this.appleReticle = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.026, 8, 32), this.appleReticleMat);
    this.appleReticle.rotation.x = Math.PI / 2;
    this.scene.add(this.appleReticle);

    // Patrolling 3D Hazards + Shatter Debris Pool
    const moverCount = (this.m.movers || []).length;
    this.moverActors = [];
    for (let i = 0; i < moverCount; i++) {
      const grp = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.40, 0),
        new THREE.MeshStandardMaterial({
          color: b.moverColor,
          emissive: b.moverColor,
          emissiveIntensity: 0.6,
          roughness: 0.18,
          metalness: 0.4,
        })
      );
      core.castShadow = true;
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.44, 0.045, 8, 24),
        new THREE.MeshStandardMaterial({
          color: 0xff6b35,
          emissive: 0xff6b35,
          emissiveIntensity: 0.65,
          roughness: 0.25,
        })
      );
      collar.rotation.x = Math.PI / 2;
      grp.add(core, collar);
      grp.visible = false;
      this.scene.add(grp);
      this.moverActors.push({ grp, core, collar });
    }

    this.maxShards = Math.max(1, moverCount * 32);
    this.shardMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.35 }),
      this.maxShards
    );
    this.shardMesh.castShadow = true;
    o.scale.set(0, 0, 0);
    o.updateMatrix();
    for (let i = 0; i < this.maxShards; i++) {
      this.shardMesh.setMatrixAt(i, o.matrix);
      this.shardMesh.setColorAt(i, this._tmpColor.setHex((i & 1) ? b.moverColor : 0xff6b35));
    }
    this.shardMesh.instanceMatrix.needsUpdate = true;
    this.shardMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.shardMesh);

    // Stateless Eat-Spark Bursts
    this.maxSparks = 64;
    this.sparkMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.3 }),
      this.maxSparks
    );
    o.scale.set(0, 0, 0);
    o.updateMatrix();
    for (let i = 0; i < this.maxSparks; i++) {
      this.sparkMesh.setMatrixAt(i, o.matrix);
      this.sparkMesh.setColorAt(i, this._tmpColor.setHex(b.goldenColor));
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.sparkMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.sparkMesh);

    // Translucent 3D Holographic Ghost Snake (leading 10 segments)
    this.maxGhostSegs = 12;
    const ghostMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.65,
      transparent: true,
      opacity: 0.44,
      roughness: 0.2,
      depthWrite: false,
    });
    this.ghostMesh = new THREE.InstancedMesh(
      makeRoundedPillGeometry(0.58, 0.42, 0.58, 0.18, 0.06),
      ghostMat,
      this.maxGhostSegs
    );
    o.scale.set(0, 0, 0);
    o.updateMatrix();
    for (let i = 0; i < this.maxGhostSegs; i++) this.ghostMesh.setMatrixAt(i, o.matrix);
    this.ghostMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.ghostMesh);
  }

  _buildKeycapCluster() {
    const W = this.m.width, H = this.m.height;
    const b = this.biome;
    const padScale = Math.max(W, H) / 12;
    const zPad = H / 2 + 0.65 + 1.85 * padScale;
    const step = 1.08 * padScale;

    this.keyPadGroup = new THREE.Group();
    const housingGeo = makeRoundedPillGeometry(3.85 * padScale, 0.34 * padScale, 2.48 * padScale, 0.30 * padScale, 0.06 * padScale);
    const housingMat = new THREE.MeshStandardMaterial({
      color: b.plinthColor,
      roughness: 0.42,
      metalness: 0.38,
    });
    const housing = new THREE.Mesh(housingGeo, housingMat);
    housing.position.set(0, -0.42, zPad);
    housing.castShadow = true;
    housing.receiveShadow = true;
    this.keyPadGroup.add(housing);

    const arrowRadius = 0.17 * padScale;
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, arrowRadius);
    arrowShape.lineTo(arrowRadius * 0.86, -arrowRadius * 0.68);
    arrowShape.lineTo(-arrowRadius * 0.86, -arrowRadius * 0.68);
    arrowShape.closePath();
    const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, {
      depth: 0.055 * padScale,
      bevelEnabled: false,
    });
    arrowGeo.rotateX(-Math.PI / 2);

    const stemGeo = new THREE.BoxGeometry(0.78 * padScale, 0.22 * padScale, 0.78 * padScale);
    const capGeo = makeKeycapGeometry(THREE, padScale);

    const topY = -0.42 + 0.17 * padScale;
    const restY = topY + 0.28 * padScale;
    const capColorHex = b.light ? 0x1e293b : 0x1b2333;
    const accentColorHex = b.frameColor;

    const specs = [
      ['up', 0, 0, zPad - 0.54 * padScale, 0],
      ['right', 1, step, zPad + 0.54 * padScale, -Math.PI / 2],
      ['down', 2, 0, zPad + 0.54 * padScale, Math.PI],
      ['left', 3, -step, zPad + 0.54 * padScale, Math.PI / 2],
    ];

    this.keyCaps = [];
    this._keyBaseColor = new THREE.Color(capColorHex);
    this._keyActiveColor = new THREE.Color(b.accentCss);
    this._keyLegendRest = new THREE.Color(0xcbd5e1);
    this._keyLegendHot = new THREE.Color(0xffffff);

    for (const [name, dir, kx, kz, rotY] of specs) {
      const stemMat = new THREE.MeshStandardMaterial({
        color: accentColorHex,
        emissive: accentColorHex,
        emissiveIntensity: 0.3,
        roughness: 0.25,
      });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(kx, topY + 0.06 * padScale, kz);
      this.keyPadGroup.add(stem);

      const capGroup = new THREE.Group();
      capGroup.position.set(kx, restY, kz);

      const capMat = new THREE.MeshPhysicalMaterial({
        color: capColorHex,
        emissive: accentColorHex,
        emissiveIntensity: 0.05,
        roughness: 0.22,
        metalness: 0.14,
        clearcoat: 0.9,
        clearcoatRoughness: 0.10,
      });
      const capMesh = new THREE.Mesh(capGeo, capMat);
      capMesh.castShadow = true;
      capMesh.receiveShadow = true;

      const arrowMat = new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        emissive: accentColorHex,
        emissiveIntensity: 0.25,
        roughness: 0.2,
      });
      const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
      arrowMesh.position.set(0, 0.184 * padScale, 0);
      arrowMesh.rotation.y = rotY;

      capGroup.add(capMesh, arrowMesh);
      this.keyPadGroup.add(capGroup);

      this.keyCaps.push({
        name,
        dir,
        kx,
        kz,
        restY,
        travel: 0.19 * padScale,
        capGroup,
        capMat,
        stemMat,
        arrowMat,
        worldPos: new THREE.Vector3(kx, restY, kz),
      });
    }

    this.scene.add(this.keyPadGroup);
  }

  _updateTiles(frame, nmFactor, ms) {
    const W = this.m.width;
    const H = this.m.height;
    const total = W * H;
    const b = this.biome;
    const left = Math.max(0, this.m.capacity - (frame.len ?? 3));
    const isFull = left === 0;
    const headCell = frame.base?.[0] ?? 0;
    const hx = headCell % W, hy = (headCell / W) | 0;

    if (this.rimMat) {
      const baseRim = this.m.wrap ? 0.65 : 0.28;
      this.rimMat.emissiveIntensity = left > 0 && left <= 12
        ? baseRim + ((13 - left) / 12) * 0.55
        : baseRim;
    }

    const occSet = (left > 0 && left <= 12 && frame.base) ? new Set(frame.base) : null;

    // Determine danger highlight cells near snake head during near-miss
    let warnSet = null;
    if (nmFactor > 0.05 && frame.base && frame.base.length > 2) {
      warnSet = new Set();
      const bodySet = new Set(frame.base.slice(1, -1));
      const deltas = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      for (const [dx, dy] of deltas) {
        let nx = hx + dx, ny = hy + dy;
        if (this.m.wrap) { nx = (nx + W) % W; ny = (ny + H) % H; }
        else if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nc = ny * W + nx;
        if (!this._obsSet.has(nc) && bodySet.has(nc)) warnSet.add(nc);
      }
    }

    const shockAge = (frame.fullMs !== undefined && frame.fullMs !== null && ms >= frame.fullMs)
      ? Math.max(0, ms - frame.fullMs)
      : -1;

    const o = this._tmpObj;
    for (let i = 0; i < total; i++) {
      if (this._obsSet.has(i)) continue;
      const gx = i % W, gy = (i / W) | 0;
      const baseHex = ((gx + gy) & 1) ? b.tileA : b.tileB;
      this._tmpColor.setHex(baseHex);
      let y = -0.04;

      if (warnSet && warnSet.has(i)) {
        const pulse = 0.55 * nmFactor * (0.6 + 0.4 * Math.sin(ms * 0.025));
        this._tmpColor.lerp(this._cDanger, clamp(pulse, 0, 0.7));
      } else if (isFull && shockAge >= 0) {
        const dist = Math.hypot(gx - hx, gy - hy);
        const waveFront = shockAge * 0.018;
        const band = Math.exp(-Math.pow((dist - waveFront) * 0.55, 2));
        this._tmpColor.lerp(this._cGold, clamp(0.18 + band * 0.55, 0, 0.75));
        y += band * 0.08;
      } else if (occSet && !occSet.has(i)) {
        const wave = 0.5 + 0.5 * Math.sin(ms * 0.012 + (gx + gy) * 0.45);
        const glowAmt = clamp((0.18 + 0.16 * wave) * ((13 - left) / 12), 0.12, 0.42);
        this._tmpColor.lerp(this._cGold, glowAmt);
        y += 0.022 + 0.016 * wave;
      }

      this.tileMesh.setColorAt(i, this._tmpColor);
      o.position.set(this._cellX(i), y, this._cellZ(i));
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      this.tileMesh.setMatrixAt(i, o.matrix);
    }
    this.tileMesh.instanceColor.needsUpdate = true;
    this.tileMesh.instanceMatrix.needsUpdate = true;
  }

  _updateSnake(frame, nmFactor, ms) {
    const base = frame.base;
    const target = frame.target;
    const f = frame.f;
    if (!base || !base.length) return;

    const W = this.m.width;
    const H = this.m.height;
    const b = this.biome;
    const pts = [];

    for (let i = 0; i < base.length; i++) {
      const a = base[i];
      const t = i < target.length ? target[i] : a;
      const ax = a % W, ay = (a / W) | 0;
      const tx = t % W, ty = (t / W) | 0;
      const dx = tx - ax, dy = ty - ay;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        pts.push({ x: this._cellX(a), z: this._cellZ(a), wrapped: true });
      } else {
        pts.push({
          x: (ax + dx * f) - (W - 1) * 0.5,
          z: (ay + dy * f) - (H - 1) * 0.5,
          wrapped: false,
        });
      }
    }

    // Extended swallow wave along the body
    const n = pts.length;
    const swallowScale = new Float32Array(n).fill(1);
    const eatEvents = frame.eatEvents || [];
    for (let e = eatEvents.length - 1; e >= 0; e--) {
      const ev = eatEvents[e];
      if (ev.ms > ms) continue;
      const age = ms - ev.ms;
      if (age > 920) break;
      const pos = (age / 920) * Math.min(n - 1, 36);
      const sigma = 2.0;
      const amp = ev.golden ? 0.34 : 0.24;
      for (let k = 1; k < n; k++) {
        const d = k - pos;
        if (Math.abs(d) > 4.2) continue;
        swallowScale[k] = Math.max(swallowScale[k], 1 + amp * Math.exp(-(d * d) / (2 * sigma * sigma)));
      }
    }

    const shockAge = (frame.fullMs !== undefined && frame.fullMs !== null && ms >= frame.fullMs)
      ? Math.max(0, ms - frame.fullMs)
      : -1;

    this._cA.setHex(b.snakeA);
    this._cMid.setHex(b.snakeMid || b.snakeA);
    this._cB.setHex(b.snakeB);
    const o = this._tmpObj;
    let count = 0;
    const maxCount = this.snakeMesh.count;

    // Emit 3-stop gradient body segments + smooth capsule bridges where adjacent
    for (let i = 0; i < n && count < maxCount; i++) {
      const p = pts[i];
      const tNorm = i / Math.max(1, n - 1);
      const tailTaper = i > n - 4 ? lerp(0.95, 0.72, (i - (n - 4)) / 3) : 1.0;
      const waveY = shockAge >= 0 ? Math.sin(shockAge * 0.015 - i * 0.45) * 0.06 * Math.exp(-shockAge / 1800) : 0;
      const sw = swallowScale[i];

      if (tNorm < 0.48) {
        this._tmpColor.copy(this._cA).lerp(this._cMid, tNorm / 0.48);
      } else {
        this._tmpColor.copy(this._cMid).lerp(this._cB, (tNorm - 0.48) / 0.52);
      }
      if (i <= 4) {
        this._tmpColor.lerp(this._cHeadColor, (5 - i) * 0.09);
      }
      if (shockAge >= 0 && shockAge < 420) {
        this._tmpColor.lerp(this._keyLegendHot, 0.28 * Math.exp(-shockAge / 130));
      }

      if (i > 0) {
        const s = tailTaper * sw;
        o.position.set(p.x, 0.27 * s + waveY, p.z);
        o.rotation.set(0, 0, 0);
        o.scale.set(s, s, s);
        o.updateMatrix();
        this.snakeMesh.setColorAt(count, this._tmpColor);
        this.snakeMesh.setMatrixAt(count, o.matrix);
        count++;
      }

      if (i + 1 < n && count < maxCount) {
        const q = pts[i + 1];
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        if (Math.abs(dx) <= 1.15 && Math.abs(dz) <= 1.15) {
          const dist = Math.hypot(dx, dz);
          if (dist > 0.04) {
            const mx = (p.x + q.x) * 0.5;
            const mz = (p.z + q.z) * 0.5;
            const angle = Math.atan2(-dz, dx);
            const midS = tailTaper * Math.max(swallowScale[i], swallowScale[i + 1]);
            o.position.set(mx, 0.27 * midS + waveY, mz);
            o.rotation.set(0, angle, 0);
            o.scale.set(clamp(dist / 0.65, 0.65, 1.35) * midS, midS, 0.96 * midS);
            o.updateMatrix();
            this.snakeMesh.setColorAt(count, this._tmpColor);
            this.snakeMesh.setMatrixAt(count, o.matrix);
            count++;
          }
        }
      }
    }

    o.scale.set(0, 0, 0);
    o.updateMatrix();
    for (let k = count; k < maxCount; k++) this.snakeMesh.setMatrixAt(k, o.matrix);
    this.snakeMesh.instanceMatrix.needsUpdate = true;
    this.snakeMesh.instanceColor.needsUpdate = true;

    // Position and orient 3D Head + apple-tracking eyes
    const hp = pts[0];
    const neck = n > 1 ? pts[1] : null;
    let yaw = 0;
    if (neck && Math.abs(hp.x - neck.x) <= 1.25 && Math.abs(hp.z - neck.z) <= 1.25) {
      yaw = Math.atan2(-(hp.z - neck.z), hp.x - neck.x);
    } else if (target.length > 0 && base[0] !== target[0]) {
      const hx0 = base[0] % W, hy0 = (base[0] / W) | 0;
      const hx1 = target[0] % W, hy1 = (target[0] / W) | 0;
      const dx = clamp(hx1 - hx0, -1, 1), dy = clamp(hy1 - hy0, -1, 1);
      if (Math.abs(hx1 - hx0) <= 1 && Math.abs(hy1 - hy0) <= 1) yaw = Math.atan2(-dy, dx);
    }

    const headScale = 1 + (swallowScale[0] - 1) * 0.5;
    this.headGroup.position.set(hp.x, 0.30, hp.z);
    this.headGroup.rotation.set(0, yaw, 0);
    this.headGroup.scale.setScalar(headScale);

    // Compute gaze angle in head local space
    let lookX = 0.06, lookZ = 0;
    if (frame.apple && frame.apple.cell >= 0) {
      const ax = this._cellX(frame.apple.cell) - hp.x;
      const az = this._cellZ(frame.apple.cell) - hp.z;
      const cY = Math.cos(-yaw), sY = Math.sin(-yaw);
      const lx = ax * cY - az * sY;
      const lz = ax * sY + az * cY;
      const mag = Math.max(0.001, Math.hypot(lx, lz));
      lookX = (lx / mag) * 0.055;
      lookZ = (lz / mag) * 0.055;
    }
    const pupilScale = 1 + 0.30 * nmFactor;
    this.leftPupil.position.set(0.25 + lookX, 0.34, -0.22 + lookZ);
    this.rightPupil.position.set(0.25 + lookX, 0.34, 0.22 + lookZ);
    this.leftPupil.scale.setScalar(pupilScale);
    this.rightPupil.scale.setScalar(pupilScale);
  }

  _updateApple(frame, ms) {
    if (!frame.apple || frame.apple.cell < 0 || (frame.len ?? 0) >= this.m.capacity) {
      this.appleGroup.visible = false;
      this.appleReticle.visible = false;
      this.appleLight.intensity = 0;
      return;
    }
    this.appleGroup.visible = true;
    this.appleReticle.visible = true;
    const x = this._cellX(frame.apple.cell);
    const z = this._cellZ(frame.apple.cell);
    const bob = 0.44 + Math.sin(ms * 0.005) * 0.06;
    this.appleGroup.position.set(x, bob, z);
    this.appleReticle.position.set(x, 0.035, z);
    const retScale = 1 + Math.sin(ms * 0.008) * 0.12;
    this.appleReticle.scale.setScalar(retScale);
    this.appleReticleMat.color.setHex(frame.apple.golden ? this.biome.goldenColor : this.biome.appleColor);
    this.appleReticleMat.opacity = 0.52 + 0.24 * (0.5 + 0.5 * Math.sin(ms * 0.008));

    this.appleLight.position.set(x, 1.15, z);
    this.appleLight.color.setHex(frame.apple.golden ? this.biome.goldenColor : this.biome.appleColor);
    this.appleLight.intensity = frame.apple.golden ? 2.2 : 1.4;

    const gold = !!frame.apple.golden;
    this.normalAppleMesh.visible = !gold;
    this.stemMesh.visible = !gold;
    this.leafMesh.visible = !gold;
    this.goldenAppleMesh.visible = gold;
    this.goldenRingMesh.visible = gold;

    if (gold) {
      this.appleGroup.rotation.set(0, 0, 0);
      this.goldenAppleMesh.rotation.set(ms * 0.0016, ms * 0.0032, 0);
      this.goldenRingMesh.rotation.set(Math.PI / 2 + Math.sin(ms * 0.003) * 0.35, ms * 0.002, 0);
      const pulse = 1 + Math.sin(ms * 0.008) * 0.08;
      this.goldenAppleMesh.scale.setScalar(pulse);
    } else {
      this.normalAppleMesh.rotation.set(0, 0, 0);
      this.appleGroup.rotation.set(0, ms * 0.0022, 0);
    }
  }

  _updateMoversAndShatter(frame, ms) {
    const movers = this.m.movers || [];
    const shatterMs = frame.moverShatterMs;
    const shattered = frame.moversGone || (shatterMs !== undefined && shatterMs !== null && ms >= shatterMs);
    const o = this._tmpObj;

    for (let i = 0; i < movers.length; i++) {
      const actor = this.moverActors[i];
      if (!actor) continue;
      if (shattered) {
        actor.grp.visible = false;
        continue;
      }
      const m = movers[i];
      const path = m.path;
      const cA = path[(frame.tick + m.phase) % path.length];
      const cB = path[(frame.tick + 1 + m.phase) % path.length];
      const wx = lerp(this._cellX(cA), this._cellX(cB), frame.f);
      const wz = lerp(this._cellZ(cA), this._cellZ(cB), frame.f);
      actor.grp.visible = true;
      actor.grp.position.set(wx, 0.45 + Math.sin(ms * 0.007 + i) * 0.05, wz);
      actor.core.rotation.set(ms * 0.003, ms * 0.0045, 0);
      actor.collar.rotation.z = ms * 0.005;
    }

    let shardIdx = 0;
    if (movers.length && shatterMs !== undefined && shatterMs !== null && ms >= shatterMs && ms - shatterMs < 1850) {
      const t = (ms - shatterMs) / 1000;
      const fade = t > 1.15 ? Math.max(0, 1 - (t - 1.15) / 0.70) : 1;
      const shatterTick = frame.moverShatterTick ?? frame.tick;
      const gAccel = 18.0;

      for (let mi = 0; mi < movers.length; mi++) {
        const m = movers[mi];
        const mc = m.path[(shatterTick + m.phase) % m.path.length];
        const mx0 = this._cellX(mc);
        const mz0 = this._cellZ(mc);

        for (let k = 0; k < 32 && shardIdx < this.maxShards; k++) {
          const r1 = hash01(mi * 1000 + k * 37 + 1);
          const r2 = hash01(mi * 1000 + k * 73 + 2);
          const r3 = hash01(mi * 1000 + k * 109 + 3);
          const angle = r1 * Math.PI * 2;
          const horiz = 1.6 + r2 * 4.8;
          const vx = Math.cos(angle) * horiz;
          const vz = Math.sin(angle) * horiz;
          const vy0 = 3.2 + r3 * 4.5;

          const x = mx0 + vx * t;
          const z = mz0 + vz * t;
          // Analytic single-bounce parabola
          const yRaw = 0.45 + vy0 * t - 0.5 * gAccel * t * t;
          let y = yRaw;
          if (y < 0.08) {
            const tHit = (vy0 + Math.sqrt(vy0 * vy0 + 2 * gAccel * 0.37)) / gAccel;
            const dt = Math.max(0, t - tHit);
            const vRebound = (gAccel * tHit - vy0) * 0.46;
            y = Math.max(0.08, 0.08 + vRebound * dt - 0.5 * gAccel * dt * dt);
          }

          o.position.set(x, y, z);
          o.rotation.set(t * (4 + r1 * 8), t * (5 + r2 * 9), t * (3 + r3 * 6));
          o.scale.setScalar((0.75 + 0.55 * r3) * fade);
          o.updateMatrix();
          this.shardMesh.setMatrixAt(shardIdx++, o.matrix);
        }
      }
    }
    o.scale.set(0, 0, 0);
    o.updateMatrix();
    for (let k = shardIdx; k < this.maxShards; k++) this.shardMesh.setMatrixAt(k, o.matrix);
    this.shardMesh.instanceMatrix.needsUpdate = true;
  }

  _updateSparks(frame, ms) {
    const eatEvents = frame.eatEvents || [];
    const o = this._tmpObj;
    let idx = 0;

    for (let e = eatEvents.length - 1; e >= 0 && idx < this.maxSparks; e--) {
      const ev = eatEvents[e];
      if (ev.ms > ms) continue;
      const age = ms - ev.ms;
      if (age > 620) break;
      if (ev.cell === undefined || ev.cell < 0) continue;

      const t = age / 1000;
      const fade = Math.max(0, 1 - age / 620);
      const count = ev.golden ? 14 : 8;
      const ex = this._cellX(ev.cell);
      const ez = this._cellZ(ev.cell);
      this._tmpColor.setHex(ev.golden ? this.biome.goldenColor : this.biome.appleColor);

      for (let k = 0; k < count && idx < this.maxSparks; k++) {
        const ang = (k / count) * Math.PI * 2 + (ev.tick * 0.4);
        const speed = ev.golden ? 3.8 : 2.6;
        const x = ex + Math.cos(ang) * speed * t;
        const z = ez + Math.sin(ang) * speed * t;
        const y = Math.max(0.12, 0.45 + 3.4 * t - 9.0 * t * t);
        o.position.set(x, y, z);
        o.rotation.set(t * 7 + k, t * 5, k);
        o.scale.setScalar(fade * (ev.golden ? 1.15 : 0.88));
        o.updateMatrix();
        this.sparkMesh.setColorAt(idx, this._tmpColor);
        this.sparkMesh.setMatrixAt(idx, o.matrix);
        idx++;
      }
    }

    o.scale.set(0, 0, 0);
    o.updateMatrix();
    for (let k = idx; k < this.maxSparks; k++) this.sparkMesh.setMatrixAt(k, o.matrix);
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.sparkMesh.instanceColor.needsUpdate = true;
  }

  _updateGhost(frame) {
    const o = this._tmpObj;
    const g = frame.ghost;
    let idx = 0;
    if (g && g.base && g.base.length) {
      const W = this.m.width, H = this.m.height;
      const count = Math.min(this.maxGhostSegs, g.base.length);
      for (let i = 0; i < count; i++) {
        const a = g.base[i];
        const t = i < g.target.length ? g.target[i] : a;
        const ax = a % W, ay = (a / W) | 0;
        const tx = t % W, ty = (t / W) | 0;
        const dx = tx - ax, dy = ty - ay;
        const x = (Math.abs(dx) > 1 ? ax : ax + dx * g.f) - (W - 1) * 0.5;
        const z = (Math.abs(dy) > 1 ? ay : ay + dy * g.f) - (H - 1) * 0.5;
        const s = lerp(0.92, 0.54, i / Math.max(1, count - 1));
        o.position.set(x, 0.48, z);
        o.rotation.set(0, 0, 0);
        o.scale.setScalar(s);
        o.updateMatrix();
        this.ghostMesh.setMatrixAt(idx++, o.matrix);
      }
    }
    o.scale.set(0, 0, 0);
    o.updateMatrix();
    for (let k = idx; k < this.maxGhostSegs; k++) this.ghostMesh.setMatrixAt(k, o.matrix);
    this.ghostMesh.instanceMatrix.needsUpdate = true;
  }

  _updateKeycapCluster(frame) {
    if (!this.keyCaps || !this.keyCaps.length) return;
    const lights = frame.keyLights || NO_KEYS;
    for (const cap of this.keyCaps) {
      const lit = lights[cap.name] || 0;
      cap.capGroup.position.y = cap.restY - cap.travel * lit;
      cap.stemMat.emissiveIntensity = 0.30 + 2.2 * lit;
      cap.capMat.color.copy(this._keyBaseColor).lerp(this._keyActiveColor, lit * 0.85);
      cap.capMat.emissiveIntensity = 0.05 + 0.45 * lit;
      cap.arrowMat.color.copy(this._keyLegendRest).lerp(this._keyLegendHot, lit);
      cap.arrowMat.emissiveIntensity = 0.25 + 1.35 * lit;
    }
  }

  _updateCamera(frame, W, H, nmFactor, ms) {
    const aspect = W / Math.max(1, H);
    const vertical = H > W * 1.2;
    const padScale = Math.max(this.m.width, this.m.height) / 12;
    const zNorth = -(this.m.height / 2 + 0.59);
    const zSouth = this.m.height / 2 + 0.65 + 3.10 * padScale;
    const spanX = this.m.width + 1.36;
    const spanZ = zSouth - zNorth;
    const zMid = (zNorth + zSouth) * 0.5;

    const elev = THREE.MathUtils.degToRad(vertical ? 50 : 53);
    const fovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const tanHalfY = Math.tan(fovRad / 2);

    const minDistHoriz = spanX / (2 * tanHalfY * Math.max(0.42, aspect) * (vertical ? 0.90 : 0.76));
    const minDistVert = (spanZ * Math.sin(elev) + 1.55) / (2 * tanHalfY * (vertical ? 0.66 : 0.80));
    let dist = Math.max(minDistHoriz, minDistVert);

    let heroIntro = 0;
    if (frame.clipStartMs !== undefined && ms >= frame.clipStartMs && ms - frame.clipStartMs < 750) {
      heroIntro = Math.pow(1 - (ms - frame.clipStartMs) / 750, 3);
    }

    dist *= (1 - 0.15 * heroIntro) * (1 - 0.07 * nmFactor);

    let focusX = 0, focusZ = 0;
    if (frame.camFocus) {
      focusX = frame.camFocus.x;
      focusZ = frame.camFocus.z;
    } else if (frame.base && frame.base.length) {
      focusX = this._cellX(frame.base[0]);
      focusZ = this._cellZ(frame.base[0]);
    }
    if (heroIntro > 0 && frame.apple && frame.apple.cell >= 0) {
      const ax = this._cellX(frame.apple.cell);
      const az = this._cellZ(frame.apple.cell);
      focusX = lerp(focusX, (focusX + ax) * 0.5, heroIntro * 0.55);
      focusZ = lerp(focusZ, (focusZ + az) * 0.5, heroIntro * 0.55);
    }

    const followWeight = 0.10 + 0.14 * nmFactor + 0.28 * heroIntro;
    const tx = focusX * followWeight;
    const tz = zMid * (1 - 0.35 * heroIntro) + focusZ * followWeight;

    const camY = dist * Math.sin(elev);
    const camZ = tz + dist * Math.cos(elev);
    this.camera.position.set(tx, camY, camZ);
    this.camera.lookAt(tx, -0.25, tz);

    if (frame.moverShatterMs !== undefined && frame.moverShatterMs !== null && ms >= frame.moverShatterMs) {
      const dt = ms - frame.moverShatterMs;
      if (dt < 260) {
        const shake = (1 - dt / 260) * 0.18;
        this.camera.position.x += Math.sin(dt * 0.19) * shake;
        this.camera.position.y += Math.cos(dt * 0.23) * shake * 0.6;
      }
    }
  }

  _drawBackdrop(W, H) {
    const { ctx, biome } = this;
    if (this._bgImg && this._bgImg.complete && this._bgImg.naturalWidth > 0) {
      const iw = this._bgImg.naturalWidth;
      const ih = this._bgImg.naturalHeight;
      const sc = Math.max(W / iw, H / ih);
      const dw = iw * sc;
      const dh = ih * sc;
      ctx.drawImage(this._bgImg, (W - dw) * 0.5, (H - dh) * 0.5, dw, dh);

      const topAlpha = biome.key === 'alabaster' ? 0.18 : 0.34;
      const botAlpha = biome.key === 'alabaster' ? 0.20 : 0.38;
      const tg = ctx.createLinearGradient(0, 0, 0, H * 0.24);
      tg.addColorStop(0, `rgba(6,10,18,${topAlpha})`);
      tg.addColorStop(1, 'rgba(6,10,18,0)');
      ctx.fillStyle = tg;
      ctx.fillRect(0, 0, W, H * 0.24);

      const bg = ctx.createLinearGradient(0, H * 0.80, 0, H);
      bg.addColorStop(0, 'rgba(6,10,18,0)');
      bg.addColorStop(1, `rgba(6,10,18,${botAlpha})`);
      ctx.fillStyle = bg;
      ctx.fillRect(0, H * 0.80, W, H * 0.20);
      return;
    }

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, biome.bgTop);
    g.addColorStop(0.55, biome.bgMid);
    g.addColorStop(1, biome.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Subtle soft studio spotlight halo behind center
    const rg = ctx.createRadialGradient(W * 0.5, H * 0.44, W * 0.05, W * 0.5, H * 0.46, Math.max(W, H) * 0.56);
    rg.addColorStop(0, biome.light ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.08)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }

  _drawHudAndKeys(W, H, frame, nmFactor) {
    const { ctx, biome } = this;
    const vertical = H > W * 1.2;
    const ms = frame.ms ?? 0;
    const len = frame.len ?? 3;
    const cap = this.m.capacity;
    const left = Math.max(0, cap - len);
    const isFull = left === 0;
    const unit = vertical ? W : Math.min(W, H);

    ctx.save();
    // Top safe-zone HUD pill
    const pillW = Math.round(vertical ? W * 0.86 : Math.min(W * 0.56, 560));
    const pillH = Math.round(vertical ? unit * 0.145 : unit * 0.14);
    const px = Math.round((W - pillW) / 2);
    const py = Math.round(vertical ? H * 0.088 : H * 0.03);

    ctx.fillStyle = biome.hudCard;
    ctx.strokeStyle = isFull ? biome.goldCss : (nmFactor > 0.15 ? biome.dangerCss : biome.hudBorder);
    ctx.lineWidth = Math.max(2, Math.round(unit * 0.004));
    ctx.beginPath();
    ctx.roundRect(px, py, pillW, pillH, Math.round(pillH * 0.24));
    ctx.fill();
    ctx.stroke();

    const cx = W / 2;
    ctx.textAlign = 'center';

    // Top eyebrow (opening hook, near-miss alert, end hook, or stage label)
    const hookActive = frame.hook && ms <= frame.hook.untilMs;
    const endActive = frame.endHook && ms >= frame.endHook.fromMs;
    let eyebrow = this.m.arenaName && this.m.arenaName !== 'CLASSIC GRID' ? this.m.arenaName : (this.m.title || 'IMPOSSIBLE SNAKE');
    let eyebrowColor = biome.accentBrightCss;

    if (endActive) {
      eyebrow = `${frame.endHook.en || 'HUMAN OR BOT?'} · ${frame.endHook.sub || '100% COMPLETE'}`;
      eyebrowColor = biome.goldCss;
    } else if (nmFactor > 0.15) {
      eyebrow = '⚡ MILLIMETER ESCAPE';
      eyebrowColor = biome.dangerCss;
    } else if (hookActive) {
      eyebrow = frame.hook.en || `${eyebrow} · ZERO MISTAKES`;
      eyebrowColor = biome.accentBrightCss;
    }

    ctx.font = `800 ${Math.round(pillH * 0.22)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = eyebrowColor;
    ctx.fillText(eyebrow, cx, py + Math.round(pillH * 0.34), pillW * 0.90);

    // Main live squares-left counter
    const mainText = isFull
      ? '100% COMPLETE'
      : `${left} SQUARE${left === 1 ? '' : 'S'} LEFT`;
    ctx.font = `900 ${Math.round(pillH * 0.36)}px ui-monospace, "Cascadia Code", monospace`;
    ctx.fillStyle = isFull ? biome.goldCss : biome.hudText;
    ctx.fillText(mainText, cx, py + Math.round(pillH * 0.74), pillW * 0.90);

    // Sub-progress track or ghost race bar at bottom edge of header card
    const barW = Math.round(pillW * 0.84);
    const barH = Math.max(5, Math.round(pillH * 0.06));
    const bx = Math.round(cx - barW / 2);
    const by = py + pillH - Math.round(pillH * 0.14);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.roundRect(bx, by, barW, barH, barH / 2);
    ctx.fill();
    const fillRatio = clamp(len / cap, 0, 1);
    ctx.fillStyle = isFull ? biome.goldCss : biome.accentCss;
    ctx.beginPath();
    ctx.roundRect(bx, by, Math.max(barH, Math.round(barW * fillRatio)), barH, barH / 2);
    ctx.fill();

    // Live Ghost comparison badge when playing against a target run in the web app
    if (frame.ghost) {
      const youPct = Math.floor((len / cap) * 100);
      const ghostPct = Math.floor((frame.ghost.length / cap) * 100);
      const badgeW = Math.round(pillW * 0.68);
      const badgeH = Math.round(pillH * 0.28);
      const gx0 = Math.round(cx - badgeW / 2);
      const gy0 = py + pillH + Math.round(unit * 0.014);
      ctx.fillStyle = biome.hudCard;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(gx0, gy0, badgeW, badgeH, badgeH / 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = `800 ${Math.round(badgeH * 0.52)}px ui-monospace, monospace`;
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`YOU ${youPct}%   vs   👻 ${ghostPct}%`, cx, gy0 + Math.round(badgeH * 0.69), badgeW * 0.92);
    }

    // Floating +1 / ★ +3 score pops above recently eaten apples
    const eatEvents = frame.eatEvents || [];
    if (eatEvents.length) {
      ctx.font = `900 ${Math.round(unit * 0.036)}px ui-monospace, monospace`;
      ctx.lineWidth = Math.max(3, Math.round(unit * 0.005));
      for (let e = eatEvents.length - 1; e >= 0; e--) {
        const ev = eatEvents[e];
        if (ev.ms > ms) continue;
        const age = ms - ev.ms;
        if (age > 480) break;
        if (ev.cell === undefined || ev.cell < 0) continue;
        const pNorm = age / 480;
        this._projVec.set(this._cellX(ev.cell), 0.78 + pNorm * 0.68, this._cellZ(ev.cell));
        this._projVec.project(this.camera);
        if (this._projVec.z > 1) continue;
        const sx = (this._projVec.x * 0.5 + 0.5) * W;
        const sy = (-this._projVec.y * 0.5 + 0.5) * H;
        const label = ev.golden ? '★ +3' : '+1';
        ctx.save();
        ctx.globalAlpha = clamp((1 - pNorm) * 1.35, 0, 1);
        ctx.strokeStyle = 'rgba(8, 12, 22, 0.85)';
        ctx.strokeText(label, sx, sy);
        ctx.fillStyle = ev.golden ? biome.goldCss : '#ffffff';
        ctx.fillText(label, sx, sy);
        ctx.restore();
      }
    }

    // End CTA sub-card when board hits 100% in video capture (positioned safely below top card)
    if (endActive) {
      const ctaH = Math.round(pillH * 0.28);
      const ctaY = vertical ? Math.round(py + pillH + unit * 0.044) : Math.round(H * 0.87);
      ctx.fillStyle = biome.hudCard;
      ctx.strokeStyle = biome.goldCss;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(Math.round(cx - pillW * 0.43), Math.round(ctaY - ctaH / 2), Math.round(pillW * 0.86), ctaH, ctaH / 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = `700 ${Math.round(pillH * 0.18)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillStyle = biome.hudText;
      ctx.textBaseline = 'middle';
      ctx.fillText('Play vs This Exact Run · Link in Comments', cx, ctaY + 1, pillW * 0.80);
      ctx.textBaseline = 'alphabetic';
    }

    ctx.restore();
  }

  keyRects() {
    const W = this.c.width, H = this.c.height;
    const vertical = H > W * 1.2;
    const kw = Math.max(26, Math.round(vertical ? W * 0.088 : Math.min(W * 0.06, 64)));
    this.camera.updateMatrixWorld();
    const out = [];
    for (const cap of this.keyCaps || []) {
      this._projVec.copy(cap.worldPos).project(this.camera);
      const px = (this._projVec.x * 0.5 + 0.5) * W;
      const py = (-this._projVec.y * 0.5 + 0.5) * H;
      out.push([cap.dir, px - kw / 2, py - kw / 2, kw]);
    }
    return out;
  }

  keyAt(cx, cy) {
    for (const [dir, x, y, kw] of this.keyRects()) {
      const pad = kw * 0.14;
      if (cx >= x - pad && cx <= x + kw + pad && cy >= y - pad && cy <= y + kw + pad) return dir;
    }
    return null;
  }

  /**
   * Renders the full 3D arena + actors + 3D macro-pad into WebGL, composites onto the
   * main 2D canvas over the studio tabletop plate with optical bloom and vector HUD.
   */
  paint(frame) {
    if (this._disposed) return;
    const W = this.c.width, H = this.c.height;
    this._ensureSize(W, H);
    const ms = frame.ms ?? 0;

    let nmFactor = 0;
    if (frame.nearMiss && ms >= frame.nearMiss.startMs - 160 && ms <= frame.nearMiss.endMs + 220) {
      const center = (frame.nearMiss.startMs + frame.nearMiss.endMs) * 0.5;
      const halfSpan = Math.max(180, (frame.nearMiss.endMs - frame.nearMiss.startMs) * 0.5 + 200);
      const norm = clamp(1 - Math.abs(ms - center) / halfSpan, 0, 1);
      nmFactor = Math.sin(norm * Math.PI * 0.5);
    }

    this._updateTiles(frame, nmFactor, ms);
    this._updateSnake(frame, nmFactor, ms);
    this._updateApple(frame, ms);
    this._updateMoversAndShatter(frame, ms);
    this._updateSparks(frame, ms);
    this._updateGhost(frame);
    this._updateKeycapCluster(frame);
    this._updateCamera(frame, W, H, nmFactor, ms);

    this.webgl.render(this.scene, this.camera);

    this.ctx.direction = 'ltr';
    this._drawBackdrop(W, H);
    this.ctx.drawImage(this.glCanvas, 0, 0, W, H);
    if (this._bloomCtx && this._bloomCanvas.width > 0) {
      const bw = this._bloomCanvas.width, bh = this._bloomCanvas.height;
      this._bloomCtx.clearRect(0, 0, bw, bh);
      this._bloomCtx.drawImage(this.glCanvas, 0, 0, bw, bh);
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'screen';
      this.ctx.globalAlpha = this.biome.light ? 0.09 : 0.18;
      this.ctx.drawImage(this._bloomCanvas, 0, 0, W, H);
      this.ctx.restore();
    }
    this._drawHudAndKeys(W, H, frame, nmFactor);
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._envRT?.dispose();
    this.webgl.dispose();
  }
}

/**
 * Replays a recorded log through core/game.js and drives Painter3D for video capture.
 */
export class Renderer3D {
  constructor(canvas, log, opts = {}) {
    this.log = log;
    this.dirs = log.dirs.split('').map(Number);
    this.replay();
    this.painter = new Painter3D(canvas, {
      ...log,
      capacity: this.capacity,
      biome: opts.biome || log.biome,
    });
  }

  replay() {
    const g = new Game(stageFromLog(this.log), this.log.seed);
    this.snaps = [g.snake.slice()];
    this.apples = [{ cell: g.apple, golden: g.appleGolden }];
    this.moversGone = [g.moversGone];
    this.eatEvents = [];
    for (let i = 0; i < this.dirs.length; i++) {
      const prevApple = g.apple;
      const ev = g.step(this.dirs[i]);
      this.snaps.push(g.snake.slice());
      this.apples.push(
        g.snake.length >= g.capacity
          ? { cell: -1, golden: false }
          : { cell: g.apple, golden: g.appleGolden }
      );
      this.moversGone.push(g.moversGone);
      if (ev && ev.ate) {
        this.eatEvents.push({
          tick: ev.tick,
          ms: this.log.tickStartMs[i] ?? 0,
          cell: prevApple,
          golden: !!ev.golden,
        });
      }
    }
    this.capacity = g.capacity;
    const fullTick = this.log.fullAtTick;
    this.fullMs = (fullTick !== null && fullTick !== undefined)
      ? (this.log.tickStartMs[fullTick] ?? this.log.tickStartMs[this.log.tickStartMs.length - 1])
      : null;
    this.verified = g.snake.length >= g.capacity || this.log.finalLength >= this.log.capacity;
  }

  tickAt(ms) {
    const t = this.log.tickStartMs;
    let lo = 0, hi = t.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (t[mid] <= ms) lo = mid; else hi = mid - 1; }
    const next = lo + 1 < t.length ? t[lo + 1] : t[lo] + 60;
    return { i: lo, f: Math.min(1, Math.max(0, (ms - t[lo]) / Math.max(1, next - t[lo]))) };
  }

  keyLights(ms) {
    const lit = { ...NO_KEYS };
    const names = ['up', 'right', 'down', 'left'];
    for (const e of this.log.keys) {
      if (e.ms > ms) break;
      const age = ms - e.ms;
      if (age < 130) lit[names[e.dir]] = Math.max(lit[names[e.dir]], 1 - age / 130);
    }
    return lit;
  }

  _camFocusAt(i, f) {
    const W = this.log.width, H = this.log.height;
    let sx = 0, sz = 0, cnt = 0;
    const k0 = Math.max(0, i - 8);
    for (let k = k0; k <= i; k++) {
      const c = this.snaps[k][0];
      const cx = (c % W) - (W - 1) * 0.5;
      const cz = ((c / W) | 0) - (H - 1) * 0.5;
      const w = k === i ? (0.4 + 0.6 * (1 - f)) : 1;
      sx += cx * w;
      sz += cz * w;
      cnt += w;
    }
    const nextIdx = Math.min(i + 1, this.snaps.length - 1);
    const nc = this.snaps[nextIdx][0];
    sx += ((nc % W) - (W - 1) * 0.5) * f;
    sz += (((nc / W) | 0) - (H - 1) * 0.5) * f;
    cnt += f;
    return { x: sx / Math.max(1, cnt), z: sz / Math.max(1, cnt) };
  }

  draw(ms) {
    const { i, f } = this.tickAt(ms);
    const base = this.snaps[i];
    const target = this.snaps[Math.min(i + 1, this.snaps.length - 1)];
    this.painter.paint({
      base,
      target,
      f,
      apple: this.apples[i],
      tick: i,
      moversGone: this.moversGone[i],
      len: base.length,
      ms,
      clipStartMs: this.log.clipStartMs ?? 0,
      keyLights: this.keyLights(ms),
      hook: this.hook,
      endHook: this.endHook,
      eatEvents: this.eatEvents,
      fullMs: this.fullMs,
      nearMiss: this.log.nearMiss || null,
      moverShatterTick: this.log.moverShatterTick ?? null,
      moverShatterMs: this.log.moverShatterMs ?? null,
      camFocus: this._camFocusAt(i, f),
    });
  }
}
