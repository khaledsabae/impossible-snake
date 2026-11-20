// V5 3D WebGL engine (Three.js) for the 4-Color Snake Battle Arena ("Pick your color").
// Stateless and deterministic: every frame is derived strictly from `(frame, ms)`
// so both Playwright video capture seeking and live web play render identically.

import * as THREE from '../vendor/three.module.js';
import { BattleGame, COLORS } from '../core/battle.js';
import { MegaBattleGame, MEGA_COLORS } from '../core/mega-battle.js';
import { NO_KEYS } from './renderer.js';
import {
  BIOMES_3D,
  makeRoundedPillGeometry,
  buildStudioSoftboxes,
  loadBiomeBackdrop,
  drawBiomeBackdrop,
  projectKeyRects,
  buildKeycapCluster,
  updateKeycapCluster,
  hash01,
  lerp,
  clamp,
} from './renderer3d.js';
import {
  makeAppleBodyGeometry,
  makeAppleLeafGeometry,
  makeCrownGeometry,
} from './blender-meshes.js';

const MAX_APPLES = 80;
const MAX_SHARDS = 180;
const MAX_SPARKS = 64;

/**
 * Shared 3D 4-Color Battle Arena painter driving both offline video capture and live web play.
 */
export class BattlePainter3D {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts { width, height, biome, showKeys, playerColor }
   */
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = opts.width || 18;
    this.h = opts.height || 18;
    this.colors = (opts.colors && opts.colors.length) ? opts.colors : COLORS;
    this.showKeys = Boolean(opts.showKeys);
    this.playerColor = opts.playerColor ?? null;
    const biomeKey = opts.biome && BIOMES_3D[opts.biome] ? opts.biome : 'colosseum';
    this.biome = BIOMES_3D[biomeKey];
    this._disposed = false;

    this._tmpObj = new THREE.Object3D();
    this._tmpColor = new THREE.Color();
    this._projVec = new THREE.Vector3();
    this._warnTileColorA = new THREE.Color(0x991b1b);
    this._warnTileColorB = new THREE.Color(0xd97706);
    this._pillarCapColor = new THREE.Color(this.biome.obstacleCap);
    this._shrinkCapColor = new THREE.Color(0xd97706);
    this._normalReticleColor = new THREE.Color(this.biome.appleColor);
    this._goldenReticleColor = new THREE.Color(this.biome.goldenColor);
    this._whiteFlash = new THREE.Color(0xffffff);
    this._cHead = new THREE.Color();
    this._cBodyA = new THREE.Color();
    this._cBodyB = new THREE.Color();
    this._envRT = null;

    const bg = loadBiomeBackdrop(this.biome.key);
    this._bgImg = bg.img;
    this._bgReady = bg.ready;

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
    this.webgl.toneMappingExposure = 1.10;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, canvas.width / Math.max(1, canvas.height), 0.5, 180);
    this._w = 0;
    this._h = 0;
    this._ensureSize(canvas.width, canvas.height);

    this._buildLights();
    this._buildArenaGeometry();
    this._buildPooledActors();

    if (this.showKeys) {
      const pIdx = this.playerColor ?? 2;
      const pCol = this.colors[pIdx] || this.colors[0];
      const accentHex = parseInt(pCol.bodyA.slice(1), 16);
      const pad = buildKeycapCluster(this.scene, this.w, this.h, this.biome.plinthColor, accentHex, this.biome.light);
      this.keyPadGroup = pad.keyPadGroup;
      this.keyCaps = pad.keyCaps;
      this._keyBaseColor = pad.keyBaseColor;
      this._keyActiveColor = new THREE.Color(pCol.bodyA);
      this._keyLegendRest = new THREE.Color(0xcbd5e1);
      this._keyLegendHot = new THREE.Color(0xffffff);
    } else {
      this.keyCaps = [];
    }

    this._updateCamera({}, canvas.width || 1080, canvas.height || 1920, 0, null);
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

  _cellX(c) { return (c % this.w) - (this.w - 1) * 0.5; }
  _cellZ(c) { return ((c / this.w) | 0) - (this.h - 1) * 0.5; }

  _buildLights() {
    const b = this.biome;
    this._envRT = buildStudioSoftboxes(this.webgl, b);
    this.scene.environment = this._envRT.texture;

    const hemi = new THREE.HemisphereLight(b.skyLight, b.groundLight, b.ambientIntensity);
    this.scene.add(hemi);

    const span = Math.max(this.w, this.h) * 0.72;
    const key = new THREE.DirectionalLight(0xffffff, b.keyIntensity);
    key.position.set(9.5, 22.0, 11.5);
    key.castShadow = true;
    key.shadow.mapSize.set(768, 768);
    key.shadow.radius = 2;
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 60;
    key.shadow.camera.left = -(span + 2);
    key.shadow.camera.right = span + 2;
    key.shadow.camera.top = span + 2;
    key.shadow.camera.bottom = -(span + (this.showKeys ? 7 : 3));
    key.shadow.bias = -0.0008;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(b.frameColor, 0.55);
    rim.position.set(-12, 8, -12);
    this.scene.add(rim);
  }

  _buildArenaGeometry() {
    const W = this.w, H = this.h, b = this.biome;
    const total = W * H;

    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 24, H + 26),
      new THREE.ShadowMaterial({ opacity: b.light ? 0.22 : 0.42 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, -0.78, 1.5);
    shadowPlane.receiveShadow = true;
    this.scene.add(shadowPlane);

    const plinth = new THREE.Mesh(
      makeRoundedPillGeometry(W + 1.24, 0.54, H + 1.24, 0.48, 0.08),
      new THREE.MeshStandardMaterial({ color: b.plinthColor, roughness: 0.55, metalness: 0.28 })
    );
    plinth.position.y = -0.49;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.scene.add(plinth);

    const slab = new THREE.Mesh(
      makeRoundedPillGeometry(W + 0.58, 0.32, H + 0.58, 0.34, 0.06),
      new THREE.MeshStandardMaterial({ color: b.slabColor, roughness: 0.36, metalness: b.light ? 0.08 : 0.34 })
    );
    slab.position.y = -0.22;
    slab.receiveShadow = true;
    this.scene.add(slab);

    const pColorDef = this.colors[this.playerColor] || this.colors[0];
    const rimColor = this.playerColor !== null ? parseInt(pColorDef.bodyA.slice(1), 16) : b.frameColor;
    this.rimBaseColor = new THREE.Color(rimColor);
    this.rimMat = new THREE.MeshStandardMaterial({
      color: rimColor,
      emissive: rimColor,
      emissiveIntensity: 0.34,
      roughness: 0.25,
      metalness: 0.4,
    });
    const barThick = 0.12, barH = 0.14;
    const north = new THREE.Mesh(new THREE.BoxGeometry(W + 0.44, barH, barThick), this.rimMat);
    north.position.set(0, -0.02, -(H / 2 + 0.17));
    const south = north.clone();
    south.position.z = H / 2 + 0.17;
    const west = new THREE.Mesh(new THREE.BoxGeometry(barThick, barH, H + 0.44), this.rimMat);
    west.position.set(-(W / 2 + 0.17), -0.02, 0);
    const east = west.clone();
    east.position.x = W / 2 + 0.17;
    this.scene.add(north, south, west, east);

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
      const gx = i % W, gy = (i / W) | 0;
      o.position.set(this._cellX(i), -0.04, this._cellZ(i));
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      this.tileMesh.setMatrixAt(i, o.matrix);
      this._tmpColor.setHex(((gx + gy) & 1) ? b.tileA : b.tileB);
      this.tileMesh.setColorAt(i, this._tmpColor);
    }
    this.tileMesh.instanceMatrix.needsUpdate = true;
    this.tileMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.tileMesh);

    // Dynamic Obstacle Monoliths (4 symmetrical pillars + closing shrink walls)
    const obsBaseGeo = makeRoundedPillGeometry(0.92, 0.74, 0.92, 0.14, 0.05);
    const obsBaseMat = new THREE.MeshStandardMaterial({
      color: b.obstacleBase,
      emissive: b.obstacleEmissive,
      emissiveIntensity: 0.28,
      roughness: 0.35,
      metalness: 0.35,
    });
    const obsCapGeo = makeRoundedPillGeometry(0.76, 0.10, 0.76, 0.10, 0.02);
    const obsCapMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x1a0d05,
      emissiveIntensity: 0.12,
      roughness: 0.24,
      metalness: 0.45,
    });
    this.obsBaseMesh = new THREE.InstancedMesh(obsBaseGeo, obsBaseMat, total);
    this.obsCapMesh = new THREE.InstancedMesh(obsCapGeo, obsCapMat, total);
    this.obsBaseMesh.castShadow = true;
    this.obsBaseMesh.receiveShadow = true;
    this.obsCapMesh.castShadow = true;
    o.scale.set(0, 0, 0);
    o.updateMatrix();
    for (let i = 0; i < total; i++) {
      this.obsBaseMesh.setMatrixAt(i, o.matrix);
      this.obsCapMesh.setMatrixAt(i, o.matrix);
      this.obsCapMesh.setColorAt(i, this._pillarCapColor);
    }
    this.obsBaseMesh.instanceMatrix.needsUpdate = true;
    this.obsCapMesh.instanceMatrix.needsUpdate = true;
    this.obsCapMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.obsBaseMesh, this.obsCapMesh);
  }

  _buildPooledActors() {
    const total = this.w * this.h;
    const maxSegs = total * 2 + 24;
    const o = this._tmpObj;

    // 4-Snake shared PBR clearcoat body segment pool
    const segGeo = makeRoundedPillGeometry(0.76, 0.52, 0.76, 0.24, 0.085);
    const segMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.10,
      clearcoat: 1.0,
      clearcoatRoughness: 0.07,
    });
    this.snakeBodyMesh = new THREE.InstancedMesh(segGeo, segMat, maxSegs);
    this.snakeBodyMesh.castShadow = true;
    this.snakeBodyMesh.receiveShadow = true;
    o.scale.set(0, 0, 0);
    o.updateMatrix();
    for (let i = 0; i < maxSegs; i++) {
      this.snakeBodyMesh.setMatrixAt(i, o.matrix);
      this.snakeBodyMesh.setColorAt(i, this._whiteFlash);
    }
    this.snakeBodyMesh.instanceMatrix.needsUpdate = true;
    this.snakeBodyMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.snakeBodyMesh);

    // 4 Individual 3D Heads with apple-tracking eyes
    const headGeo = makeRoundedPillGeometry(0.84, 0.60, 0.84, 0.26, 0.095);
    const scleraGeo = new THREE.SphereGeometry(0.145, 12, 10);
    const scleraMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 });
    const pupilGeo = new THREE.SphereGeometry(0.082, 10, 8);
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x090d14, roughness: 0.1 });

    this.headActors = this.colors.map((col) => {
      const grp = new THREE.Group();
      const headTint = new THREE.Color(col.head).lerp(new THREE.Color(col.bodyA), 0.30);
      const mat = new THREE.MeshPhysicalMaterial({
        color: headTint,
        roughness: 0.14,
        metalness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
      });
      const mesh = new THREE.Mesh(headGeo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const leftEye = new THREE.Mesh(scleraGeo, scleraMat);
      const rightEye = new THREE.Mesh(scleraGeo, scleraMat);
      leftEye.position.set(0.20, 0.29, -0.22);
      rightEye.position.set(0.20, 0.29, 0.22);
      const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
      const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
      grp.add(mesh, leftEye, rightEye, leftPupil, rightPupil);
      grp.visible = false;
      this.scene.add(grp);
      return { grp, mat, leftPupil, rightPupil };
    });

    // Player beacon torus ring for interactive web play
    this.beaconMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.64, 0.055, 10, 32),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      })
    );
    this.beaconMesh.rotation.x = Math.PI / 2;
    this.beaconMesh.visible = false;
    this.scene.add(this.beaconMesh);

    // Sculpted Blender 4.5 Champion Crown floating over longest contender
    this.crownMesh = new THREE.Mesh(
      makeCrownGeometry(THREE, 1.38),
      new THREE.MeshPhysicalMaterial({
        color: 0xffd166,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.38,
        metalness: 0.85,
        roughness: 0.14,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
      })
    );
    this.crownMesh.castShadow = true;
    this.crownMesh.visible = false;
    this.scene.add(this.crownMesh);

    // Multi-Apple Instanced Pools (sculpted Blender apple + leaf + golden octahedron + floor reticle)
    this.appleBodyMesh = new THREE.InstancedMesh(
      makeAppleBodyGeometry(THREE, 0.88),
      new THREE.MeshPhysicalMaterial({
        color: 0xff4d5a,
        emissive: 0xef4444,
        emissiveIntensity: 0.34,
        roughness: 0.14,
        metalness: 0.14,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
      }),
      MAX_APPLES
    );
    this.appleLeafMesh = new THREE.InstancedMesh(
      makeAppleLeafGeometry(THREE, 0.88),
      new THREE.MeshPhysicalMaterial({
        color: 0x22c55e,
        emissive: 0x15803d,
        emissiveIntensity: 0.22,
        roughness: 0.22,
        clearcoat: 0.8,
      }),
      MAX_APPLES
    );
    this.goldenAppleMesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.36, 0),
      new THREE.MeshPhysicalMaterial({
        color: 0xffbe0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.52,
        roughness: 0.14,
        metalness: 0.55,
        clearcoat: 1.0,
      }),
      MAX_APPLES
    );
    const reticleGeo = new THREE.TorusGeometry(0.42, 0.025, 8, 28);
    reticleGeo.rotateX(Math.PI / 2);
    this.appleReticleMesh = new THREE.InstancedMesh(
      reticleGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.70 }),
      MAX_APPLES
    );
    this.appleBodyMesh.castShadow = true;
    this.goldenAppleMesh.castShadow = true;
    o.scale.set(0, 0, 0);
    o.updateMatrix();
    for (let i = 0; i < MAX_APPLES; i++) {
      this.appleBodyMesh.setMatrixAt(i, o.matrix);
      this.appleLeafMesh.setMatrixAt(i, o.matrix);
      this.goldenAppleMesh.setMatrixAt(i, o.matrix);
      this.appleReticleMesh.setMatrixAt(i, o.matrix);
      this.appleReticleMesh.setColorAt(i, this._normalReticleColor);
    }
    this.appleBodyMesh.instanceMatrix.needsUpdate = true;
    this.appleLeafMesh.instanceMatrix.needsUpdate = true;
    this.goldenAppleMesh.instanceMatrix.needsUpdate = true;
    this.appleReticleMesh.instanceMatrix.needsUpdate = true;
    this.appleReticleMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.appleBodyMesh, this.appleLeafMesh, this.goldenAppleMesh, this.appleReticleMesh);

    // Shatter Debris Pool for 2.5x Slow-Motion Eliminations
    this.shardMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.24, metalness: 0.35 }),
      MAX_SHARDS
    );
    this.shardMesh.castShadow = true;
    for (let i = 0; i < MAX_SHARDS; i++) {
      this.shardMesh.setMatrixAt(i, o.matrix);
      this.shardMesh.setColorAt(i, this._whiteFlash);
    }
    this.shardMesh.instanceMatrix.needsUpdate = true;
    this.shardMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.shardMesh);

    // Eat Spark Bursts
    this.sparkMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.13, 0.13, 0.13),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.3 }),
      MAX_SPARKS
    );
    for (let i = 0; i < MAX_SPARKS; i++) {
      this.sparkMesh.setMatrixAt(i, o.matrix);
      this.sparkMesh.setColorAt(i, this._goldenReticleColor);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.sparkMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.sparkMesh);
  }

  _updateBoardAndObstacles(frame, activeElim, isWon, winCol, ms) {
    const W = this.w, H = this.h, total = W * H, b = this.biome;
    const obsSet = new Set(frame.obstacles || []);
    const shrinkRing = frame.shrinkRing || 0;
    const shrinkImminent = Boolean(frame.shrinkImminent);

    if (this.rimMat) {
      if (isWon) {
        this.rimMat.color.set(winCol.bodyA);
        this.rimMat.emissive.set(winCol.bodyA);
        this.rimMat.emissiveIntensity = 0.72;
      } else if (activeElim) {
        const eCol = this.colors[activeElim.id] || this.colors[0];
        this.rimMat.color.set(eCol.bodyA);
        this.rimMat.emissive.set(eCol.bodyA);
        this.rimMat.emissiveIntensity = 0.65;
      } else {
        this.rimMat.color.copy(this.rimBaseColor);
        this.rimMat.emissive.copy(this.rimBaseColor);
        this.rimMat.emissiveIntensity = 0.34;
      }
    }

    const o = this._tmpObj;
    const pulse = 0.5 + 0.5 * Math.sin(ms / 85);
    let obsCount = 0;
    for (let i = 0; i < total; i++) {
      const gx = i % W, gy = (i / W) | 0;
      const ring = Math.min(gx, gy, W - 1 - gx, H - 1 - gy);
      const x = this._cellX(i), z = this._cellZ(i);

      if (obsSet.has(i)) {
        o.position.set(x, -0.04, z);
        o.rotation.set(0, 0, 0);
        o.scale.set(0, 0, 0);
        o.updateMatrix();
        this.tileMesh.setMatrixAt(i, o.matrix);

        const isShrinkWall = ring < shrinkRing;
        o.position.set(x, isShrinkWall ? 0.34 : 0.42, z);
        o.scale.set(1, isShrinkWall ? 0.85 : 1, 1);
        o.updateMatrix();
        this.obsBaseMesh.setMatrixAt(obsCount, o.matrix);

        o.position.set(x, isShrinkWall ? 0.68 : 0.82, z);
        o.scale.set(1, 1, 1);
        o.updateMatrix();
        this.obsCapMesh.setMatrixAt(obsCount, o.matrix);
        this.obsCapMesh.setColorAt(obsCount, isShrinkWall ? this._shrinkCapColor : this._pillarCapColor);
        obsCount++;
      } else {
        const warn = shrinkImminent && ring === shrinkRing;
        o.position.set(x, warn ? -0.02 + pulse * 0.04 : -0.04, z);
        o.rotation.set(0, 0, 0);
        o.scale.set(1, 1, 1);
        o.updateMatrix();
        this.tileMesh.setMatrixAt(i, o.matrix);

        this._tmpColor.setHex(((gx + gy) & 1) ? b.tileA : b.tileB);
        if (warn) {
          this._tmpColor.lerp(pulse > 0.5 ? this._warnTileColorB : this._warnTileColorA, 0.35 + pulse * 0.45);
        }
        this.tileMesh.setColorAt(i, this._tmpColor);
      }
    }

    o.scale.set(0, 0, 0);
    o.updateMatrix();
    for (let k = obsCount; k < total; k++) {
      this.obsBaseMesh.setMatrixAt(k, o.matrix);
      this.obsCapMesh.setMatrixAt(k, o.matrix);
    }

    this.tileMesh.instanceMatrix.needsUpdate = true;
    this.tileMesh.instanceColor.needsUpdate = true;
    this.obsBaseMesh.instanceMatrix.needsUpdate = true;
    this.obsCapMesh.instanceMatrix.needsUpdate = true;
    this.obsCapMesh.instanceColor.needsUpdate = true;
  }

  _updateSnakesAndCrown(frame, isWon, winMs, ms) {
    const snakes = frame.snakes || [];
    const nextSnakes = frame.nextSnakes || snakes;
    const f = frame.f ?? 0;
    const eatEvents = frame.eatEvents || [];
    const apples = frame.apples || [];
    const o = this._tmpObj;

    let count = 0;
    const maxCount = this.snakeBodyMesh.count;
    let leaderId = -1;
    let leaderLen = -1;
    let leaderHeadPos = null;
    const winAge = isWon && winMs !== null ? Math.max(0, ms - winMs) : -1;

    for (let sId = 0; sId < this.colors.length; sId++) {
      const sBase = snakes[sId];
      const sNext = nextSnakes[sId] || sBase;
      const headActor = this.headActors[sId];
      if (!sBase || !sBase.alive || !sBase.cells.length) {
        if (headActor) headActor.grp.visible = false;
        continue;
      }

      const base = sBase.cells;
      const target = sNext.alive ? sNext.cells : base;
      const n = base.length;
      const colDef = this.colors[sId];
      this._cHead.set(colDef.head);
      this._cBodyA.set(colDef.bodyA);
      this._cBodyB.set(colDef.bodyB);

      const pts = new Array(n);
      for (let k = 0; k < n; k++) {
        pts[k] = { x: this._cellX(base[k]), z: this._cellZ(base[k]) };
      }

      const hx0 = this._cellX(base[0]), hz0 = this._cellZ(base[0]);
      const hx1 = this._cellX(target[0]), hz1 = this._cellZ(target[0]);
      if (Math.abs(hx1 - hx0) <= 1.15 && Math.abs(hz1 - hz0) <= 1.15) {
        pts[0] = { x: lerp(hx0, hx1, f), z: lerp(hz0, hz1, f) };
      }
      if (n >= 2 && target.length === n && target[n - 1] !== base[n - 1]) {
        const tx0 = this._cellX(base[n - 1]), tz0 = this._cellZ(base[n - 1]);
        const tx1 = this._cellX(base[n - 2]), tz1 = this._cellZ(base[n - 2]);
        if (Math.abs(tx1 - tx0) <= 1.15 && Math.abs(tz1 - tz0) <= 1.15) {
          pts[n - 1] = { x: lerp(tx0, tx1, f), z: lerp(tz0, tz1, f) };
        }
      }

      // Swallow bulge along this snake's body from recent eats
      const swallowScale = new Float32Array(n).fill(1);
      for (let e = eatEvents.length - 1; e >= 0; e--) {
        const ev = eatEvents[e];
        if (ev.snakeId !== sId || ev.ms > ms) continue;
        const age = ms - ev.ms;
        if (age > 780) break;
        const p = age / 780;
        const pos = p * Math.min(n - 1, 22);
        const amp = (ev.golden ? 0.34 : 0.23) * Math.sin(p * Math.PI);
        for (let k = 0; k < n; k++) {
          const d = k - pos;
          if (Math.abs(d) > 3.6) continue;
          swallowScale[k] = Math.max(swallowScale[k], 1 + amp * Math.exp(-(d * d) / 2.2));
        }
      }

      const isChamp = isWon && sId === frame.winner;
      for (let i = 0; i < n && count < maxCount; i++) {
        const p = pts[i];
        const tNorm = i / Math.max(1, n - 1);
        const tailTaper = i > n - 3 ? lerp(0.94, 0.74, (i - (n - 3)) / 2) : 1.0;
        const sw = swallowScale[i];

        this._tmpColor.copy(this._cBodyA).lerp(this._cBodyB, tNorm);
        if (i <= 3) this._tmpColor.lerp(this._cHead, (4 - i) * 0.11);
        if (isChamp && winAge >= 0 && winAge < 420) {
          this._tmpColor.lerp(this._whiteFlash, 0.45 * Math.exp(-winAge / 130));
        }

        if (i > 0) {
          const s = tailTaper * sw;
          o.position.set(p.x, 0.27 * s, p.z);
          o.rotation.set(0, 0, 0);
          o.scale.set(s, s, s);
          o.updateMatrix();
          this.snakeBodyMesh.setColorAt(count, this._tmpColor);
          this.snakeBodyMesh.setMatrixAt(count, o.matrix);
          count++;
        }

        if (i + 1 < n && count < maxCount) {
          const q = pts[i + 1];
          const dx = q.x - p.x, dz = q.z - p.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.04 && dist <= 1.35) {
            const mx = (p.x + q.x) * 0.5, mz = (p.z + q.z) * 0.5;
            const angle = Math.atan2(-dz, dx);
            const midS = tailTaper * Math.max(swallowScale[i], swallowScale[i + 1]);
            o.position.set(mx, 0.27 * midS, mz);
            o.rotation.set(0, angle, 0);
            o.scale.set(clamp(dist / 0.65, 0.65, 1.35) * midS, midS, 0.96 * midS);
            o.updateMatrix();
            this.snakeBodyMesh.setColorAt(count, this._tmpColor);
            this.snakeBodyMesh.setMatrixAt(count, o.matrix);
            count++;
          }
        }
      }

      // Update head orientation and apple-tracking eyes
      const hp = pts[0];
      const neck = n > 1 ? pts[1] : null;
      let yaw = -sBase.dir * (Math.PI / 2) + Math.PI / 2;
      if (neck && Math.hypot(hp.x - neck.x, hp.z - neck.z) > 0.05) {
        yaw = Math.atan2(-(hp.z - neck.z), hp.x - neck.x);
      }
      headActor.grp.visible = true;
      headActor.grp.position.set(hp.x, 0.30, hp.z);
      headActor.grp.rotation.set(0, yaw, 0);
      headActor.grp.scale.setScalar(1 + (swallowScale[0] - 1) * 0.45);

      let lookX = 0.055, lookZ = 0;
      if (apples.length) {
        let bestD = Infinity;
        const cY = Math.cos(-yaw), sY = Math.sin(-yaw);
        for (const a of apples) {
          const ax = this._cellX(a.cell) - hp.x, az = this._cellZ(a.cell) - hp.z;
          const d = Math.hypot(ax, az);
          if (d < bestD && d > 0.01) {
            bestD = d;
            const lx = ax * cY - az * sY, lz = ax * sY + az * cY;
            lookX = (lx / d) * 0.055;
            lookZ = (lz / d) * 0.055;
          }
        }
      }
      headActor.leftPupil.position.set(0.25 + lookX, 0.34, -0.22 + lookZ);
      headActor.rightPupil.position.set(0.25 + lookX, 0.34, 0.22 + lookZ);

      if (sId === this.playerColor) {
        this.beaconMesh.visible = true;
        this.beaconMesh.position.set(hp.x, 0.06, hp.z);
        this.beaconMesh.scale.setScalar(1 + 0.14 * Math.sin(ms / 110));
      }

      if (n > leaderLen || (isWon && sId === frame.winner)) {
        if (!isWon || sId === frame.winner) {
          leaderLen = n;
          leaderId = sId;
          leaderHeadPos = hp;
        }
      }
    }

    if (this.playerColor !== null && (!snakes[this.playerColor] || !snakes[this.playerColor].alive)) {
      this.beaconMesh.visible = false;
    }

    if (leaderId >= 0 && leaderHeadPos) {
      this.crownMesh.visible = true;
      this.crownMesh.position.set(leaderHeadPos.x, 0.88 + Math.sin(ms / 180) * 0.06, leaderHeadPos.z);
      this.crownMesh.rotation.set(0, ms * 0.0028, 0);
    } else {
      this.crownMesh.visible = false;
    }

    o.scale.set(0, 0, 0);
    o.updateMatrix();
    for (let k = count; k < maxCount; k++) this.snakeBodyMesh.setMatrixAt(k, o.matrix);
    this.snakeBodyMesh.instanceMatrix.needsUpdate = true;
    this.snakeBodyMesh.instanceColor.needsUpdate = true;
  }

  _updateApples(frame, ms) {
    const apples = frame.apples || [];
    const o = this._tmpObj;
    let normIdx = 0, goldIdx = 0, retIdx = 0;

    for (const a of apples) {
      if (retIdx >= MAX_APPLES) break;
      const ax = this._cellX(a.cell), az = this._cellZ(a.cell);
      const bob = Math.sin(ms / 150 + a.cell * 0.35) * 0.06;
      const pulse = 1 + Math.sin(ms / 130 + a.cell * 0.2) * 0.08;

      o.position.set(ax, 0.03, az);
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(pulse);
      o.updateMatrix();
      this.appleReticleMesh.setMatrixAt(retIdx, o.matrix);
      this.appleReticleMesh.setColorAt(retIdx, a.golden ? this._goldenReticleColor : this._normalReticleColor);
      retIdx++;

      if (a.golden) {
        o.position.set(ax, 0.44 + bob, az);
        o.rotation.set(ms * 0.0012, ms * 0.0030, 0);
        o.scale.setScalar(pulse * 1.04);
        o.updateMatrix();
        this.goldenAppleMesh.setMatrixAt(goldIdx++, o.matrix);
      } else {
        o.position.set(ax, 0.39 + bob, az);
        o.rotation.set(0, ms * 0.0012 + a.cell, 0);
        o.scale.setScalar(pulse);
        o.updateMatrix();
        this.appleBodyMesh.setMatrixAt(normIdx, o.matrix);
        this.appleLeafMesh.setMatrixAt(normIdx, o.matrix);
        normIdx++;
      }
    }

    o.scale.set(0, 0, 0);
    o.updateMatrix();
    for (let k = normIdx; k < MAX_APPLES; k++) {
      this.appleBodyMesh.setMatrixAt(k, o.matrix);
      this.appleLeafMesh.setMatrixAt(k, o.matrix);
    }
    for (let k = goldIdx; k < MAX_APPLES; k++) this.goldenAppleMesh.setMatrixAt(k, o.matrix);
    for (let k = retIdx; k < MAX_APPLES; k++) this.appleReticleMesh.setMatrixAt(k, o.matrix);

    this.appleBodyMesh.instanceMatrix.needsUpdate = true;
    this.appleLeafMesh.instanceMatrix.needsUpdate = true;
    this.goldenAppleMesh.instanceMatrix.needsUpdate = true;
    this.appleReticleMesh.instanceMatrix.needsUpdate = true;
    this.appleReticleMesh.instanceColor.needsUpdate = true;
  }

  _updateShatterAndSparks(frame, ms) {
    const o = this._tmpObj;
    let shardIdx = 0;
    const elimEvents = frame.elimEvents || [];
    for (let e = elimEvents.length - 1; e >= 0 && shardIdx < MAX_SHARDS; e--) {
      const el = elimEvents[e];
      const age = ms - el.ms;
      if (age < 0 || age > 980) continue;
      const t = age / 980;
      const cells = (el.droppedCells && el.droppedCells.length) ? el.droppedCells : (el.cell >= 0 ? [el.cell] : []);
      const stride = Math.max(1, Math.ceil((cells.length * 3) / Math.max(3, MAX_SHARDS - shardIdx)));
      this._cBodyA.set(this.colors[el.id]?.bodyA || '#ff4d5a');

      for (let i = 0; i < cells.length && shardIdx < MAX_SHARDS; i += stride) {
        const ox = this._cellX(cells[i]), oz = this._cellZ(cells[i]);
        for (let p = 0; p < 3 && shardIdx < MAX_SHARDS; p++) {
          const seed = cells[i] * 73 + el.id * 19 + p * 97;
          const ang = hash01(seed) * Math.PI * 2;
          const spd = 1.6 + hash01(seed + 1) * 2.4;
          const vy = 2.6 + hash01(seed + 2) * 2.6;
          const px = ox + Math.cos(ang) * spd * t;
          const pz = oz + Math.sin(ang) * spd * t;
          const py = Math.max(0.08, 0.35 + vy * t - 3.6 * t * t);
          const sc = (1 - t * 0.78) * (0.75 + hash01(seed + 3) * 0.6);
          o.position.set(px, py, pz);
          o.rotation.set(t * 7 + seed, t * 9, t * 5);
          o.scale.setScalar(sc);
          o.updateMatrix();
          this.shardMesh.setColorAt(shardIdx, this._cBodyA);
          this.shardMesh.setMatrixAt(shardIdx, o.matrix);
          shardIdx++;
        }
      }
    }
    o.scale.set(0, 0, 0);
    o.updateMatrix();
    for (let k = shardIdx; k < MAX_SHARDS; k++) this.shardMesh.setMatrixAt(k, o.matrix);
    this.shardMesh.instanceMatrix.needsUpdate = true;
    this.shardMesh.instanceColor.needsUpdate = true;

    let sparkIdx = 0;
    const eatEvents = frame.eatEvents || [];
    for (let e = eatEvents.length - 1; e >= 0 && sparkIdx < MAX_SPARKS; e--) {
      const ev = eatEvents[e];
      if (ev.ms > ms) continue;
      const age = ms - ev.ms;
      if (age > 420) break;
      const t = age / 420;
      const ox = this._cellX(ev.cell), oz = this._cellZ(ev.cell);
      const count = ev.golden ? 10 : 6;
      const col = ev.golden ? this._goldenReticleColor : this._normalReticleColor;
      for (let s = 0; s < count && sparkIdx < MAX_SPARKS; s++) {
        const ang = (s / count) * Math.PI * 2 + ev.tick * 0.4;
        const rad = 0.25 + t * (ev.golden ? 1.55 : 1.05);
        o.position.set(ox + Math.cos(ang) * rad, 0.38 + Math.sin(t * Math.PI) * 0.65, oz + Math.sin(ang) * rad);
        o.rotation.set(t * 5, t * 7 + s, t * 3);
        o.scale.setScalar((1 - t) * (ev.golden ? 1.2 : 0.85));
        o.updateMatrix();
        this.sparkMesh.setColorAt(sparkIdx, col);
        this.sparkMesh.setMatrixAt(sparkIdx, o.matrix);
        sparkIdx++;
      }
    }
    o.scale.set(0, 0, 0);
    o.updateMatrix();
    for (let k = sparkIdx; k < MAX_SPARKS; k++) this.sparkMesh.setMatrixAt(k, o.matrix);
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.sparkMesh.instanceColor.needsUpdate = true;
  }

  _updateCamera(frame, W, H, ms, activeElim) {
    const aspect = W / Math.max(1, H);
    const vertical = H > W * 1.2;
    const padScale = Math.max(this.w, this.h) / 12;
    const zNorth = -(this.h / 2 + 0.65);
    const zSouth = this.h / 2 + 0.72 + (this.showKeys ? 3.10 * padScale : 0.35);
    const spanX = this.w + 1.48;
    const spanZ = zSouth - zNorth;
    const zMid = (zNorth + zSouth) * 0.5;

    const elev = THREE.MathUtils.degToRad(vertical ? 50 : 54);
    const tanHalfY = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const minDistHoriz = spanX / (2 * tanHalfY * Math.max(0.42, aspect) * (vertical ? 0.90 : 0.76));
    const vertFill = vertical ? (this.colors.length > 4 ? 0.56 : 0.62) : 0.78;
    const minDistVert = (spanZ * Math.sin(elev) + 1.55) / (2 * tanHalfY * vertFill);
    let dist = Math.max(minDistHoriz, minDistVert);

    const heroIntro = ms < 750 ? Math.pow(1 - clamp(ms / 750, 0, 1), 3) : 0;
    let elimZoom = 0;
    let fx = 0, fz = 0;
    if (activeElim && activeElim.cell >= 0) {
      const age = ms - activeElim.ms;
      const norm = clamp(1 - Math.abs(age - 320) / 580, 0, 1);
      elimZoom = Math.sin(norm * Math.PI * 0.5);
      fx = this._cellX(activeElim.cell) * 0.22 * elimZoom;
      fz = this._cellZ(activeElim.cell) * 0.22 * elimZoom;
    }

    dist *= (1 - 0.14 * heroIntro) * (1 - 0.07 * elimZoom);
    const tz = zMid * (1 - 0.25 * heroIntro) + fz;
    const camY = dist * Math.sin(elev);
    const camZ = tz + dist * Math.cos(elev);
    this.camera.position.set(fx, camY, camZ);
    this.camera.lookAt(fx, -0.20, tz);

    if (activeElim && ms >= activeElim.ms && ms - activeElim.ms < 220) {
      const dt = ms - activeElim.ms;
      const shake = (1 - dt / 220) * 0.22;
      this.camera.position.x += Math.sin(dt * 0.21) * shake;
      this.camera.position.y += Math.cos(dt * 0.25) * shake * 0.6;
    }
  }

  _projectZEdgeY(worldZ, H) {
    this.camera.updateMatrixWorld();
    this._projVec.set(0, 0.35, worldZ).project(this.camera);
    return (-this._projVec.y * 0.5 + 0.5) * H;
  }

  _drawBattleHud(W, H, frame, activeElim, isWon, winCol, winMs, ms) {
    const { ctx, biome, colors } = this;
    const vertical = H > W * 1.2;
    const snakes = frame.snakes || [];
    const apples = frame.apples || [];
    const shrinkImminent = Boolean(frame.shrinkImminent);
    const ticksToShrink = frame.ticksToShrink ?? 99;
    const nColors = colors.length;
    const isMega = nColors > 4;
    const unit = vertical ? W : Math.min(W, H);
    const cxm = W / 2;

    const boardTopY = this._projectZEdgeY(-(this.h / 2 + 0.55), H);
    const boardBotY = this._projectZEdgeY(this.h / 2 + 0.55, H);

    ctx.save();
    // 1. Top Hook / Slow-Mo / Champion Banner
    const pillW = Math.round(vertical ? W * 0.90 : Math.min(W * 0.56, 560));
    const pillH = Math.round(vertical ? unit * (isMega ? 0.112 : 0.125) : unit * 0.110);
    const px = Math.round((W - pillW) / 2);
    const rows = Math.ceil(nColors / 4);
    const cardH = Math.round(vertical ? H * (rows > 1 ? 0.041 : 0.056) : H * (rows > 1 ? 0.050 : 0.064));
    const rowGap = Math.round(cardH * 0.15);
    const totalCardsH = rows * cardH + Math.max(0, rows - 1) * rowGap;
    const py = Math.round(vertical ? Math.min(H * 0.055, Math.max(14, boardTopY - totalCardsH - pillH - unit * 0.036)) : H * 0.022);

    const activeElimCol = activeElim ? (colors[activeElim.id] || colors[0]) : null;
    ctx.fillStyle = biome.hudCard;
    ctx.strokeStyle = isWon ? winCol.bodyA : (activeElimCol ? activeElimCol.bodyA : biome.hudBorder);
    ctx.lineWidth = Math.max(2, Math.round(unit * 0.004));
    ctx.beginPath();
    ctx.roundRect(px, py, pillW, pillH, Math.round(pillH * 0.24));
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    const alive = snakes.filter((s) => s.alive);
    let topSub = 'WHICH COLOR TAKES THE CROWN?';
    let topSubCol = biome.goldCss;
    let topMain = isMega ? `${alive.length} / ${nColors} SNAKES ALIVE` : `${alive.length} COLORS REMAINING`;
    let topMainCol = biome.hudText;

    if (this.playerColor !== null && snakes[this.playerColor] && !snakes[this.playerColor].alive && !isWon) {
      topSub = 'ELIMINATED · RESOLVING FINAL DUEL';
      topSubCol = '#fb7185';
      topMain = alive.length === 2 ? `${alive[0].name} VS ${alive[1].name}` : `${alive.length} REMAINING`;
    } else if (ms <= 2800) {
      topSub = isMega ? '8-SNAKE CHAOS ROYALE · LAST SNAKE STANDING' : '4-COLOR ARENA · LAST SNAKE STANDING';
      topSubCol = biome.goldCss;
      topMain = this.playerColor !== null ? `YOU ARE ${colors[this.playerColor].name}` : 'PICK YOUR COLOR';
    } else if (isWon) {
      topSub = 'CHAMPION CROWNED · DID YOUR COLOR WIN?';
      topSubCol = winCol.bodyA;
      topMain = `${winCol.name} WINS! 🏆`;
    } else if (activeElim) {
      topSub = '⚡ SLOW-MOTION KNOCKOUT';
      topSubCol = biome.goldCss;
      topMain = `${activeElim.name} ELIMINATED!`;
      topMainCol = activeElimCol.head;
    } else if (shrinkImminent) {
      topSub = '⚠ PERIMETER CLOSING IN';
      topSubCol = '#fb7185';
      topMain = `BORDER LOCK IN ${ticksToShrink}`;
    } else if (alive.length === 2) {
      topSub = 'FINAL DUEL · ONE SURVIVOR';
      topMain = `${alive[0].name} VS ${alive[1].name}`;
    }

    ctx.font = `800 ${Math.round(pillH * 0.24)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = topSubCol;
    ctx.fillText(topSub, cxm, py + Math.round(pillH * 0.36), pillW * 0.90);
    ctx.font = `900 ${Math.round(pillH * 0.42)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = topMainCol;
    ctx.fillText(topMain, cxm, py + Math.round(pillH * 0.80), pillW * 0.90);

    // 2. N-Color Scoreboard Cards (1 row for 4 colors, 2 rows for 8 colors)
    const boardSpanPx = Math.round(vertical ? W * 0.90 : Math.min(W * 0.72, 680));
    const bx = Math.round(cxm - boardSpanPx / 2);
    const gap = Math.round(boardSpanPx * 0.016);
    const colsPerRow = Math.min(4, nColors);
    const cardW = Math.floor((boardSpanPx - gap * (colsPerRow - 1)) / colsPerRow);
    const minCardY = py + pillH + Math.round(unit * 0.012);
    const cardY = Math.max(minCardY, Math.round(boardTopY - totalCardsH - Math.round(unit * 0.014)));

    let maxLen = 0;
    for (const s of snakes) if (s.alive && s.cells.length > maxLen) maxLen = s.cells.length;

    for (let i = 0; i < nColors; i++) {
      const s = snakes[i] || { alive: false, cells: [] };
      const col = colors[i];
      const rowIdx = Math.floor(i / 4);
      const colIdx = i % 4;
      const x = bx + colIdx * (cardW + gap);
      const y = cardY + rowIdx * (cardH + rowGap);
      const isPlayer = i === this.playerColor;
      const isLeader = s.alive && s.cells.length === maxLen;

      ctx.save();
      ctx.globalAlpha = s.alive ? 1 : 0.36;
      ctx.fillStyle = biome.hudCard;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, rows > 1 ? 10 : 12);
      ctx.fill();
      ctx.strokeStyle = isPlayer ? col.bodyA : (isLeader ? '#ffc93c' : 'rgba(148, 163, 184, 0.25)');
      ctx.lineWidth = isPlayer || isLeader ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, rows > 1 ? 10 : 12);
      ctx.stroke();

      ctx.fillStyle = col.bodyA;
      ctx.beginPath();
      ctx.roundRect(x + 7, y + 8, 6, cardH - 16, 3);
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.fillStyle = isPlayer ? col.head : biome.hudMuted;
      ctx.font = `800 ${Math.round(cardH * 0.26)}px ui-sans-serif, system-ui, sans-serif`;
      const tag = isPlayer ? `${col.name} (YOU)` : (isLeader ? `${col.name} 👑` : col.name);
      ctx.fillText(tag, x + 19, y + Math.round(cardH * 0.40), cardW - 24);

      ctx.fillStyle = s.alive ? biome.hudText : '#fb7185';
      ctx.font = `800 ${Math.round(cardH * 0.40)}px ui-monospace, monospace`;
      ctx.fillText(s.alive ? String(s.cells.length) : 'OUT', x + 19, y + Math.round(cardH * 0.83), cardW - 24);
      ctx.restore();
    }

    // 3. Power Bar, Live Kill Feed & Viral Voiceover Captions below board (capture / no-keys mode)
    if (!this.showKeys) {
      const totalLen = alive.reduce((acc, s) => acc + s.cells.length, 0) || 1;
      const barY = Math.min(Math.round(H * 0.775), Math.round(boardBotY + Math.round(unit * 0.018)));
      const barH = Math.max(10, Math.round(unit * 0.018));
      let curX = bx;
      for (let k = 0; k < alive.length; k++) {
        const s = alive[k];
        const w = k === alive.length - 1 ? (bx + boardSpanPx - curX) : Math.round((s.cells.length / totalLen) * boardSpanPx);
        ctx.fillStyle = colors[s.id].bodyA;
        ctx.beginPath();
        ctx.roundRect(curX, barY, Math.max(5, w - 3), barH, barH / 2);
        ctx.fill();
        curX += w;
      }

      const feedEl = frame.latestElim || activeElim;
      const feedY = barY + barH + Math.round(unit * 0.044);
      const feedH = Math.round(pillH * 0.34);
      ctx.fillStyle = biome.hudCard;
      ctx.strokeStyle = isWon ? winCol.bodyA : (feedEl ? (colors[feedEl.id]?.bodyA || biome.hudBorder) : biome.hudBorder);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(bx, feedY - feedH / 2, boardSpanPx, feedH, feedH / 2);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${Math.round(unit * 0.025)}px ui-monospace, monospace`;
      if (isWon) {
        ctx.fillStyle = biome.goldCss;
        ctx.fillText(`CHAMPION LENGTH: ${frame.winnerLength ?? alive[0]?.cells.length ?? 0} SQUARES · PICK NEXT ROUND`, cxm, feedY + 1, boardSpanPx * 0.92);
      } else if (feedEl) {
        ctx.fillStyle = biome.hudText;
        const leftTxt = feedEl.remainingCount !== undefined ? ` · ${feedEl.remainingCount} LEFT` : ` · GOLDEN LOOT DROPPED`;
        const byWho = feedEl.killerName ? `${feedEl.killerName} KNOCKED OUT ${feedEl.name}` : `${feedEl.name} HIT ${feedEl.cause || 'PERIMETER'}`;
        ctx.fillText(`${byWho}${leftTxt}`, cxm, feedY + 1, boardSpanPx * 0.92);
      } else {
        ctx.fillStyle = biome.hudMuted;
        ctx.fillText(isMega ? '8 SNAKES · SHRINKING WALLS · GOLDEN LOOT ON EVERY KO' : 'EVERY ELIMINATION DROPS GOLDEN LOOT APPLES', cxm, feedY + 1, boardSpanPx * 0.92);
      }

      // Bold animated broadcast caption driven by TTS word boundary timestamps
      if (frame.caption && frame.caption.text) {
        const capText = String(frame.caption.text).toUpperCase();
        const capY = vertical
          ? Math.min(Math.round(H * 0.875), Math.round(feedY + feedH * 1.45))
          : Math.round(H * 0.89);
        const capSize = Math.round(vertical ? unit * 0.058 : unit * 0.052);
        ctx.font = `900 ${capSize}px ui-sans-serif, system-ui, sans-serif`;
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(8, Math.round(capSize * 0.24));
        ctx.strokeStyle = 'rgba(4, 6, 12, 0.94)';
        ctx.strokeText(capText, cxm, capY, W * 0.88);
        ctx.fillStyle = frame.caption.accent || '#ffffff';
        ctx.fillText(capText, cxm, capY, W * 0.88);
      }
      ctx.textBaseline = 'alphabetic';
    }

    // 4. Crisp 420ms white celebration flash on victory
    if (isWon && winMs !== null && ms >= winMs && ms - winMs < 420) {
      const ft = 1 - (ms - winMs) / 420;
      ctx.fillStyle = `rgba(255, 255, 255, ${(ft * ft * 0.26).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  keyRects() {
    if (!this.showKeys || !this.keyCaps?.length) return [];
    return projectKeyRects(this.c, this.camera, this.keyCaps, this._projVec);
  }

  keyAt(cx, cy) {
    for (const [dir, x, y, kw] of this.keyRects()) {
      const pad = kw * 0.14;
      if (cx >= x - pad && cx <= x + kw + pad && cy >= y - pad && cy <= y + kw + pad) return dir;
    }
    return null;
  }

  paint(frame) {
    if (this._disposed) return;
    const W = this.c.width, H = this.c.height;
    this._ensureSize(W, H);
    const ms = frame.ms ?? 0;
    const winMs = frame.winMs ?? null;
    const isWon = winMs !== null && ms >= winMs;
    const winCol = this.colors[frame.winner ?? 0] || this.colors[0];

    let activeElim = null;
    for (const el of frame.elimEvents || []) {
      if (ms >= el.ms - 140 && ms <= el.ms + 920) activeElim = el;
    }

    this._updateBoardAndObstacles(frame, activeElim, isWon, winCol, ms);
    this._updateSnakesAndCrown(frame, isWon, winMs, ms);
    this._updateApples(frame, ms);
    this._updateShatterAndSparks(frame, ms);
    if (this.showKeys) {
      updateKeycapCluster(this.keyCaps, frame.keyLights, this._keyBaseColor, this._keyActiveColor, this._keyLegendRest, this._keyLegendHot);
    }
    this._updateCamera(frame, W, H, ms, activeElim);

    this.webgl.render(this.scene, this.camera);

    this.ctx.direction = 'ltr';
    drawBiomeBackdrop(this.ctx, this._bgImg, this.biome, W, H);
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
    if (!frame.hideHud) this._drawBattleHud(W, H, frame, activeElim, isWon, winCol, winMs, ms);
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.scene.traverse((obj) => {
      obj.geometry?.dispose?.();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material?.dispose?.();
    });
    this._envRT?.dispose();
    this.webgl.dispose();
  }
}

/**
 * Replays a recorded 4-Color or 8-Snake Battle log deterministically and drives
 * BattlePainter3D for offline video capture.
 */
export class BattleRenderer3D {
  constructor(canvas, log, opts = {}) {
    this.log = log;
    this.opts = opts;
    const isMega = log.mode === 'mega_battle' || (log.colors && log.colors.length > 4);
    this.colors = (log.colors && log.colors.length) ? log.colors : (isMega ? MEGA_COLORS : COLORS);
    this.w = log.width || (isMega ? 22 : 18);
    this.h = log.height || (isMega ? 22 : 18);
    this.captions = Array.isArray(log.captions) ? log.captions : [];
    this.replay();
    this.painter = new BattlePainter3D(canvas, {
      width: this.w,
      height: this.h,
      biome: opts.biome || log.biome || 'colosseum',
      showKeys: false,
      playerColor: null,
      colors: this.colors,
    });
  }

  ready() {
    return this.painter.ready();
  }

  replay() {
    const isMega = this.log.mode === 'mega_battle' || this.colors.length > 4;
    const GameCls = this.opts.gameCtor || (isMega ? MegaBattleGame : BattleGame);
    const g = new GameCls(this.log.seed, {
      width: this.w,
      height: this.h,
      targetApples: this.log.targetApples,
      shrinkStartTick: this.log.shrinkStartTick,
      shrinkEvery: this.log.shrinkEvery,
      maxShrinkRing: this.log.maxShrinkRing,
      maxTicks: this.log.maxTicks,
    });

    this.snaps = [];
    this.eatEvents = [];
    this.elimEvents = [];

    const snap = () => {
      const nextShrink = g.shrinkStartTick + g.shrinkRing * g.shrinkEvery;
      const toShrink = nextShrink - g.tick;
      return {
        tick: g.tick,
        obstacles: Array.from(g.obstacles),
        shrinkRing: g.shrinkRing,
        shrinkImminent: g.shrinkRing < g.maxShrinkRing && toShrink > 0 && toShrink <= 8,
        ticksToShrink: toShrink,
        apples: g.apples.map((a) => ({ cell: a.cell, golden: a.golden })),
        snakes: g.snakes.map((s) => ({
          id: s.id,
          name: s.name,
          alive: s.alive,
          cells: s.cells.slice(),
          dir: s.dir,
          kills: s.kills,
        })),
      };
    };

    this.snaps.push(snap());
    for (let i = 0; i < this.log.dirs.length; i++) {
      const stepMs = this.log.tickStartMs[i] ?? 0;
      const res = g.step(this.log.dirs[i]);
      this.snaps.push(snap());

      for (const a of res.ate) {
        this.eatEvents.push({ tick: res.tick, ms: stepMs, cell: a.cell, golden: !!a.golden, snakeId: a.id });
      }
      for (const el of res.eliminations) {
        this.elimEvents.push({ ...el, ms: stepMs });
      }
    }

    this.winMs = this.log.winMs ?? this.log.tickStartMs[this.log.tickStartMs.length - 1];
    this.verified = g.winner !== null && g.winner === this.log.winner && g.eliminations.length === this.colors.length - 1;
  }

  tickAt(ms) {
    const t = this.log.tickStartMs;
    let lo = 0, hi = t.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (t[mid] <= ms) lo = mid;
      else hi = mid - 1;
    }
    const next = lo + 1 < t.length ? t[lo + 1] : t[lo] + 60;
    const f = Math.min(1, Math.max(0, (ms - t[lo]) / Math.max(1, next - t[lo])));
    return { i: lo, f };
  }

  draw(ms) {
    const { i, f } = this.tickAt(ms);
    const cur = this.snaps[i];
    const nxt = this.snaps[Math.min(i + 1, this.snaps.length - 1)];
    let latestElim = null;
    for (const el of this.elimEvents) {
      if (ms >= el.ms - 100 && ms <= el.ms + 1850) latestElim = el;
    }
    let caption = null;
    for (const c of this.captions) {
      if (ms >= c.startMs && ms <= c.endMs) { caption = c; break; }
    }
    this.painter.paint({
      snakes: cur.snakes,
      nextSnakes: nxt.snakes,
      f,
      apples: cur.apples,
      obstacles: cur.obstacles,
      shrinkRing: cur.shrinkRing,
      shrinkImminent: cur.shrinkImminent,
      ticksToShrink: cur.ticksToShrink,
      eatEvents: this.eatEvents,
      elimEvents: this.elimEvents,
      latestElim,
      caption,
      winner: this.log.winner,
      winnerLength: this.log.winnerLength,
      winMs: this.winMs,
      ms,
    });
  }
}
