import * as THREE from '../vendor/three.module.min.js';
import { clamp, angleLerp } from './util.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { createVehicles, updateVehicles, putPlayerInCar } from './vehicles.js';
import { createPlayer, updatePlayer } from './player.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createShots, updateShots, spawnTracer } from './shots.js';
import { createCombat, updateCombat, playerShoot } from './combat.js';
import { createPolice, updatePolice, setWanted } from './police.js';
import { createMissions, updateMissions, startMission } from './missions.js';
import { createHud, updateHud, showMenu, hideMenu } from './hud.js';
import { loadSave, writeSave, clearSave } from './save.js';

window.__errors = [];
window.addEventListener('error', (e) => {
  window.__errors.push(String(e && e.message ? e.message : e));
});
window.addEventListener('unhandledrejection', (e) => {
  window.__errors.push('rejection: ' + String(e.reason));
});

const params = new URLSearchParams(window.location.search);
const SHOT = Number(params.get('shot') || 0);

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0x9ec3dd, 180, 420);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 40, 90);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
sun.position.set(120, 180, 60);
scene.add(sun);

const G = {
  scene,
  camera,
  renderer,
  shot: SHOT,
  state: 'menu',
  paused: false,
  time: 0,
  gameMinutes: 9 * 60,
  camYaw: Math.PI,
  camPitch: 0.32,
  menuAngle: 0,
  cars: [],
  peds: [],
  player: {
    mesh: null, health: 100, money: 250, car: null,
    velY: 0, grounded: true, moving: false, walkPhase: 0,
  },
  shotTracerDone: false,
  shot3Done: false,
};
window.__solmar = { state: 'menu', time: 0 };

G.input = createInput(canvas);
G.audio = createAudio();
G.city = createCity(scene);
createVehicles(G);
createPlayer(G);
createPedestrians(G, 24);
createShots(G);
createCombat(G);
createPolice(G);
createMissions(G);
G.loadSaveData = loadSave;
G.saveGame = () => {
  writeSave({
    money: G.player.money,
    missionIndex: G.missions.index,
    done: G.missions.done,
    health: G.player.health,
  });
};
G.vehicles = { putPlayerInCar };
G.startNewGame = () => {
  clearSave();
  G.player.money = 250;
  G.player.health = 100;
  G.player.mesh.position.set(0, 0, 8);
  G.player.mesh.rotation.y = Math.PI;
  G.player.mesh.visible = true;
  if (G.player.car) {
    G.player.car.speed = 0;
    G.player.car = null;
  }
  G.police.wanted = 0;
  hideMenu(G);
  document.getElementById('hud').classList.remove('hidden');
  G.state = 'playing';
  G.time = 0;
  startMission(G, 0);
  G.saveGame();
};
G.startContinueGame = () => {
  const s = loadSave();
  if (s) {
    G.player.money = s.money || 250;
    G.player.health = s.health || 100;
  }
  hideMenu(G);
  document.getElementById('hud').classList.remove('hidden');
  G.state = 'playing';
  G.time = 0;
  startMission(G, s ? (s.missionIndex || 0) : 0);
};
G.setPaused = (on) => {
  if (on && G.state !== 'playing') return;
  G.paused = on;
  document.getElementById('pause').classList.toggle('hidden', !on);
  if (on && document.exitPointerLock) document.exitPointerLock();
};
createHud(G);

function applyShotStaging() {
  hideMenu(G);
  document.getElementById('hud').classList.remove('hidden');
  G.state = 'playing';
  if (SHOT === 1) {
    G.player.mesh.position.set(0, 0, 16);
    G.player.mesh.rotation.y = Math.PI;
    G.camYaw = 0;
    G.camPitch = 0.28;
    startMission(G, 0);
  } else if (SHOT === 2 || SHOT === 3) {
    const car = G.cars.find((c) => !c.traffic && !c.isPolice);
    car.mesh.position.set(-50, 0, 23);
    car.heading = Math.PI / 2;
    car.mesh.rotation.y = Math.PI / 2;
    car.speed = 22;
    putPlayerInCar(G, car);
    G.camYaw = Math.PI * 1.5;
    G.camPitch = 0.22;
    startMission(G, 0);
    if (SHOT === 3) setWanted(G, 3);
  } else if (SHOT === 4) {
    G.player.mesh.position.set(100, 0, -112);
    G.player.mesh.rotation.y = Math.PI / 2;
    G.camYaw = -Math.PI / 2;
    G.camPitch = 0.35;
    startMission(G, 2);
  }
}

function updateCamera(G, dt) {
  const target = G.player.car ? G.player.car.mesh.position : G.player.mesh.position;
  if (G.player.car) {
    const targetYaw = G.player.car.heading + Math.PI;
    G.camYaw = angleLerp(G.camYaw, targetYaw, 1 - Math.exp(-1.5 * dt));
    G.camPitch = clamp(G.camPitch, 0.1, 0.6);
  }
  const d = G.player.car ? 9 : 7.5;
  const h = G.player.car ? 3.2 : 2.6;
  const cx = target.x + Math.sin(G.camYaw) * Math.cos(G.camPitch) * d;
  const cz = target.z + Math.cos(G.camYaw) * Math.cos(G.camPitch) * d;
  const cy = target.y + h + Math.sin(G.camPitch) * d;
  camera.position.set(cx, Math.max(cy, 1.2), cz);
  camera.lookAt(target.x, target.y + 1.7, target.z);
}

if (SHOT > 0) {
  applyShotStaging();
} else {
  showMenu(G);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.state === 'playing' && !G.paused) {
    G.time += dt;
    G.gameMinutes += dt * 0.5;
    G.camYaw -= G.input.mouseDX * 0.0028;
    G.camPitch = clamp(G.camPitch + G.input.mouseDY * 0.0022, -0.15, 0.95);
    if (G.input.mouseDown && G.input.locked) playerShoot(G);
    updatePlayer(G, dt);
    updateVehicles(G, dt);
    updatePedestrians(G, dt);
    updateCombat(G, dt);
    updatePolice(G, dt);
    updateMissions(G, dt);
    updateShots(G, dt);
    updateHud(G, dt);
    if (G.input.wasPressed('Escape') || G.input.wasPressed('KeyP')) G.setPaused(true);
    if (SHOT === 4 && !G.shotTracerDone && G.combat.enemies.length > 0) {
      G.shotTracerDone = true;
      const e = G.combat.enemies[0];
      const from = G.player.mesh.position.clone();
      from.y = 1.4;
      const to = e.mesh.position.clone();
      to.y = 1.2;
      spawnTracer(G, from, to);
    }
    if (SHOT === 3 && G.police.copCars.length >= 2) {
      const car = G.player.car;
      const bx = car.mesh.position.x;
      const bz = car.mesh.position.z;
      const h = car.heading;
      const fx = Math.sin(h);
      const fz = Math.cos(h);
      const rx = -Math.cos(h);
      const rz = Math.sin(h);
      for (let k = 0; k < 2; k++) {
        const side = k === 0 ? 1 : -1;
        const cop = G.police.copCars[k];
        cop.mesh.position.set(bx + fx * 2 + rx * 6.5 * side, 0, bz + fz * 2 + rz * 6.5 * side);
        cop.heading = h;
        cop.mesh.rotation.y = h;
        cop.speed = car.speed;
      }
    }
    G.audio.setEngine(!!G.player.car, G.player.car ? Math.abs(G.player.car.speed) / 40 : 0);
  } else if (G.state === 'menu') {
    G.menuAngle += dt * 0.05;
    camera.position.set(Math.sin(G.menuAngle) * 120, 55, Math.cos(G.menuAngle) * 120);
    camera.lookAt(0, 5, 0);
  }
  if (G.state === 'playing') updateCamera(G, dt);
  renderer.render(scene, camera);
  window.__solmar.state = G.state;
  window.__solmar.time = G.time;
  if (G.state === 'playing' && G.time > 1) document.title = 'shot-ready';
  G.input.endFrame();
}

animate();
