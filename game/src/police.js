import * as THREE from '../vendor/three.module.min.js';
import { rand, clamp, dist2, angleLerp } from './util.js';
import { makeCarMesh } from './vehicles.js';
import { makePersonMesh, damagePlayer } from './player.js';

export function createPolice(G) {
  G.police = {
    wanted: 0,
    lastAdd: -99,
    decayT: 0,
    copCars: [],
    footCops: [],
    bustT: 0,
    addWanted,
    setWanted,
  };
}

export function addWanted(G, n) {
  if (G.time - G.police.lastAdd < 2.5) return;
  G.police.lastAdd = G.time;
  G.police.wanted = clamp(G.police.wanted + n, 0, 5);
  G.police.decayT = 9;
}

export function setWanted(G, n) {
  G.police.wanted = clamp(n, 0, 5);
  G.police.decayT = 12;
  G.police.lastAdd = G.time;
}

function spawnCopCar(G) {
  const p = G.city.randomRoadPoint();
  const mesh = makeCarMesh(0x1c2733);
  const barR = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.14, 0.3),
    new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff0000 })
  );
  barR.position.set(-0.35, 1.42, 0);
  mesh.add(barR);
  const barB = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.14, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0000ff })
  );
  barB.position.set(0.35, 1.42, 0);
  mesh.add(barB);
  mesh.position.set(p.x, 0, p.z);
  G.scene.add(mesh);
  const car = {
    mesh, speed: 0, heading: rand(0, Math.PI * 2),
    traffic: false, isPolice: true, barR, barB, flashT: 0,
  };
  G.cars.push(car);
  G.police.copCars.push(car);
  return car;
}

function spawnFootCop(G) {
  const pp = G.player.mesh.position;
  const a = rand(0, Math.PI * 2);
  const x = pp.x + Math.sin(a) * 18;
  const z = pp.z + Math.cos(a) * 18;
  const mesh = makePersonMesh(0x1a2f4a, 0x14181d, 0xd9a066);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.4), new THREE.MeshLambertMaterial({ color: 0x0d1b2a }));
  cap.position.y = 1.68;
  mesh.add(cap);
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const cop = { mesh, walkPhase: 0 };
  G.police.footCops.push(cop);
  return cop;
}

export function updatePolice(G, dt) {
  const P = G.police;
  if (G.state !== 'playing') {
    G.audio.siren(false);
    return;
  }
  const wanted = P.wanted;
  if (wanted > 0) {
    P.decayT -= dt;
    let copNear = false;
    for (const c of P.copCars) {
      if (dist2(c.mesh.position.x, c.mesh.position.z, G.player.mesh.position.x, G.player.mesh.position.z) < 900) copNear = true;
    }
    for (const c of P.footCops) {
      if (dist2(c.mesh.position.x, c.mesh.position.z, G.player.mesh.position.x, G.player.mesh.position.z) < 900) copNear = true;
    }
    if (!copNear && P.decayT <= 0) {
      P.wanted = Math.max(0, wanted - 1);
      P.decayT = 9;
    }
  }
  const wantCars = wanted === 0 ? 0 : Math.min(wanted, 3);
  const wantCops = wanted === 0 ? 0 : (G.player.car ? 0 : Math.min(wanted, 3));
  while (P.copCars.length < wantCars) spawnCopCar(G);
  while (P.copCars.length > wantCars) {
    const c = P.copCars.pop();
    G.scene.remove(c.mesh);
    const i = G.cars.indexOf(c);
    if (i >= 0) G.cars.splice(i, 1);
  }
  while (P.footCops.length < wantCops) spawnFootCop(G);
  while (P.footCops.length > wantCops) {
    const c = P.footCops.pop();
    G.scene.remove(c.mesh);
  }
  const pp = G.player.mesh.position;
  for (const c of P.copCars) {
    const cp = c.mesh.position;
    const dx = pp.x - cp.x;
    const dz = pp.z - cp.z;
    const d = Math.hypot(dx, dz);
    const targetHeading = Math.atan2(dx, dz);
    const maxSpeed = 26 + wanted * 2.5;
    c.heading = angleLerp(c.heading, targetHeading, 1 - Math.exp(-1.6 * dt));
    c.speed = Math.min(c.speed + 16 * dt, d > 12 ? maxSpeed : maxSpeed * 0.7);
    cp.x += Math.sin(c.heading) * c.speed * dt;
    cp.z += Math.cos(c.heading) * c.speed * dt;
    c.mesh.rotation.y = c.heading;
    const cc = G.city.collide(cp.x, cp.z, 2.2);
    cp.x = cc[0];
    cp.z = cc[1];
    if (G.player.car && d < 4.2) {
      G.player.car.speed *= 0.96;
      damagePlayer(G, 3 * dt);
    }
    c.flashT += dt;
    const on = Math.floor(c.flashT * 6) % 2 === 0;
    c.barR.material.emissive.setHex(on ? 0xff0000 : 0x220000);
    c.barB.material.emissive.setHex(on ? 0x000022 : 0x0000ff);
    for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt / 0.36;
  }
  let nearestCopD = 999;
  for (const c of P.footCops) {
    const cp = c.mesh.position;
    const dx = pp.x - cp.x;
    const dz = pp.z - cp.z;
    const d = Math.hypot(dx, dz);
    nearestCopD = Math.min(nearestCopD, d);
    const h = Math.atan2(dx, dz);
    c.mesh.rotation.y = h;
    const sp = 6.5 + wanted * 0.3;
    cp.x += Math.sin(h) * sp * dt;
    cp.z += Math.cos(h) * sp * dt;
    const cc = G.city.collide(cp.x, cp.z, 0.7);
    cp.x = cc[0];
    cp.z = cc[1];
    c.walkPhase += dt * 8;
    const s = Math.sin(c.walkPhase) * 0.5;
    c.mesh.userData.legL.rotation.x = s;
    c.mesh.userData.legR.rotation.x = -s;
  }
  if (P.footCops.length > 0 && nearestCopD < 1.7) {
    P.bustT += dt;
    if (P.bustT > 1.2) {
      P.bustT = 0;
      doBusted(G);
    }
  } else {
    P.bustT = 0;
  }
  const anyNear = P.copCars.some((c) => dist2(c.mesh.position.x, c.mesh.position.z, pp.x, pp.z) < 3600);
  G.audio.siren(anyNear && wanted > 0);
}

function doBusted(G) {
  const fine = Math.min(150, Math.max(0, Math.floor(G.player.money * 0.1)));
  G.player.money -= fine;
  G.player.health = 100;
  G.police.wanted = 0;
  for (const c of G.police.copCars) {
    G.scene.remove(c.mesh);
    const i = G.cars.indexOf(c);
    if (i >= 0) G.cars.splice(i, 1);
  }
  G.police.copCars.length = 0;
  for (const c of G.police.footCops) G.scene.remove(c.mesh);
  G.police.footCops.length = 0;
  if (G.player.car) {
    G.player.car.speed = 0;
    G.player.car = null;
    G.player.mesh.visible = true;
  }
  G.player.mesh.position.set(0, 0, 8);
  G.player.mesh.rotation.y = Math.PI;
  G.audio.busted();
  if (G.missions) G.missions.onBusted(G);
  G.hud.showBusted(G, fine);
  G.saveGame();
}
