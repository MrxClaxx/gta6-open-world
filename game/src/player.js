import * as THREE from '../vendor/three.module.min.js';
import { clamp } from './util.js';

export function makePersonMesh(shirt, pants, skin) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const legGeoL = new THREE.BoxGeometry(0.22, 0.5, 0.22);
  legGeoL.translate(0, -0.25, 0);
  const legL = new THREE.Mesh(legGeoL, pantsMat);
  legL.position.set(-0.14, 0.5, 0);
  g.add(legL);
  const legGeoR = new THREE.BoxGeometry(0.22, 0.5, 0.22);
  legGeoR.translate(0, -0.25, 0);
  const legR = new THREE.Mesh(legGeoR, pantsMat);
  legR.position.set(0.14, 0.5, 0);
  g.add(legR);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.65, 0.34), shirtMat);
  torso.position.y = 0.85;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skinMat);
  head.position.y = 1.45;
  g.add(head);
  const armGeoL = new THREE.BoxGeometry(0.16, 0.55, 0.16);
  armGeoL.translate(0, -0.22, 0);
  const armL = new THREE.Mesh(armGeoL, shirtMat);
  armL.position.set(-0.4, 1.32, 0);
  g.add(armL);
  const armGeoR = new THREE.BoxGeometry(0.16, 0.55, 0.16);
  armGeoR.translate(0, -0.22, 0);
  const armR = new THREE.Mesh(armGeoR, shirtMat);
  armR.position.set(0.4, 1.32, 0);
  g.add(armR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  g.userData.armL = armL;
  g.userData.armR = armR;
  g.userData.torso = torso;
  return g;
}

export function createPlayer(G) {
  const mesh = makePersonMesh(0x2e86c1, 0x2c3e50, 0xd9a066);
  mesh.position.set(0, 0, 8);
  mesh.rotation.y = Math.PI;
  G.scene.add(mesh);
  G.player.mesh = mesh;
  G.player.velY = 0;
  G.player.grounded = true;
  G.player.moving = false;
  G.player.walkPhase = 0;
}

export function updatePlayer(G, dt) {
  if (G.player.car) return;
  const p = G.player;
  const inp = G.input;
  const fwdX = -Math.sin(G.camYaw);
  const fwdZ = -Math.cos(G.camYaw);
  const rightX = -fwdZ;
  const rightZ = fwdX;
  let mx = 0;
  let mz = 0;
  if (inp.isDown('KeyW')) { mx += fwdX; mz += fwdZ; }
  if (inp.isDown('KeyS')) { mx -= fwdX; mz -= fwdZ; }
  if (inp.isDown('KeyD')) { mx += rightX; mz += rightZ; }
  if (inp.isDown('KeyA')) { mx -= rightX; mz -= rightZ; }
  const len = Math.hypot(mx, mz);
  const sprint = inp.isDown('ShiftLeft') || inp.isDown('ShiftRight');
  const speed = sprint ? 10 : 6;
  if (len > 0) {
    mx /= len;
    mz /= len;
    p.mesh.position.x += mx * speed * dt;
    p.mesh.position.z += mz * speed * dt;
    p.mesh.rotation.y = Math.atan2(mx, mz);
    p.moving = true;
    p.walkPhase += dt * speed * 1.6;
  } else {
    p.moving = false;
  }
  if (inp.wasPressed('Space') && p.grounded) {
    p.velY = 8.5;
    p.grounded = false;
  }
  p.velY -= 24 * dt;
  p.mesh.position.y += p.velY * dt;
  if (p.mesh.position.y <= 0) {
    p.mesh.position.y = 0;
    p.velY = 0;
    p.grounded = true;
  }
  const c = G.city.collide(p.mesh.position.x, p.mesh.position.z, 0.7);
  p.mesh.position.x = c[0];
  p.mesh.position.z = c[1];
  const swing = p.moving ? Math.sin(p.walkPhase) * 0.5 : 0;
  p.mesh.userData.legL.rotation.x = swing;
  p.mesh.userData.legR.rotation.x = -swing;
  p.mesh.userData.armL.rotation.x = -swing * 0.8;
  p.mesh.userData.armR.rotation.x = swing * 0.8;
  if (inp.wasPressed('KeyE')) G.vehicles.tryEnterCar(G);
  if (inp.wasPressed('KeyF')) G.combat.playerMelee(G);
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (G.state !== 'playing') return;
  p.health -= amount;
  if (p.health <= 0) {
    p.health = 100;
    const fine = Math.min(100, Math.floor(p.money * 0.05));
    p.money -= fine;
    if (p.car) {
      p.car.speed = 0;
      p.car = null;
      p.mesh.visible = true;
    }
    p.mesh.position.set(0, 0, 8);
    p.mesh.rotation.y = Math.PI;
    G.audio.busted();
    G.hud.showToast(G, 'You were taken down. Woke up at the plaza, $' + fine + ' lighter.');
    if (G.missions && !G.missions.done) G.missions.onBusted(G);
  }
}

export function healPlayer(G, amount) {
  G.player.health = clamp(G.player.health + amount, 0, 100);
}
