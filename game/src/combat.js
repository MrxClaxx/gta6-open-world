import * as THREE from '../vendor/three.module.min.js';
import { rand, clamp } from './util.js';
import { makePersonMesh, damagePlayer, healPlayer } from './player.js';
import { spawnTracer } from './shots.js';

export function createCombat(G) {
  G.combat = {
    enemies: [],
    packs: [],
    lastShotPos: null,
    lastShotTime: -99,
    playerShoot,
    playerMelee,
    spawnEnemy,
    spawnHealthPack,
  };
  spawnHealthPack(G, 20, 0, 20);
  spawnHealthPack(G, -46, 0, 69);
  spawnHealthPack(G, 115, 0, -90);
}

export function spawnHealthPack(G, x, y, z) {
  const grp = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  grp.add(box);
  const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.05), new THREE.MeshLambertMaterial({ color: 0xe74c3c }));
  cross1.position.z = 0.36;
  grp.add(cross1);
  const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.05), new THREE.MeshLambertMaterial({ color: 0xe74c3c }));
  cross2.position.z = 0.36;
  grp.add(cross2);
  grp.position.set(x, 0.9, z);
  G.scene.add(grp);
  G.combat.packs.push({ mesh: grp, taken: false });
}

export function spawnEnemy(G, x, z) {
  const mesh = makePersonMesh(0x2d3436, 0x1a1a1a, 0xd9a066);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.42, 1.05, 0.35);
  mesh.add(gun);
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const e = { mesh, hp: 100, cooldown: rand(0.5, 1.5), dead: false, deadT: 0, flashT: 0, walkPhase: rand(0, 6) };
  G.combat.enemies.push(e);
  return e;
}

function rayHit(G, origin, dir, maxDist) {
  let best = null;
  let bestD = maxDist;
  const test = (pos, r, ref) => {
    const ox = pos.x - origin.x;
    const oy = 1.1 - origin.y;
    const oz = pos.z - origin.z;
    const t = ox * dir.x + oy * dir.y + oz * dir.z;
    if (t < 0 || t > bestD) return;
    const cx = origin.x + dir.x * t;
    const cy = origin.y + dir.y * t;
    const cz = origin.z + dir.z * t;
    const dd = Math.hypot(pos.x - cx, 1.1 - cy, pos.z - cz);
    if (dd < r) {
      best = { ref, t, point: new THREE.Vector3(cx, cy, cz) };
      bestD = t;
    }
  };
  for (const e of G.combat.enemies) if (!e.dead) test(e.mesh.position, 0.8, { kind: 'enemy', e });
  for (const p of G.peds) test(p.mesh.position, 0.8, { kind: 'ped', p });
  return best;
}

export function playerShoot(G) {
  if (G.state !== 'playing' || G.player.car) return;
  if (G.time - G.combat.lastShotTime < 0.12) return;
  G.combat.lastShotTime = G.time;
  const cam = G.camera;
  const origin = cam.position.clone();
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  dir.x += rand(-0.01, 0.01);
  dir.y += rand(-0.01, 0.01);
  dir.z += rand(-0.01, 0.01);
  dir.normalize();
  const hit = rayHit(G, origin, dir, 90);
  const from = G.player.mesh.position.clone();
  from.y = 1.4;
  const to = hit ? hit.point : origin.clone().addScaledVector(dir, 90);
  spawnTracer(G, from, to);
  G.audio.shot();
  G.combat.lastShotPos = { x: G.player.mesh.position.x, z: G.player.mesh.position.z };
  G.police.addWanted(G, 1);
  if (hit) {
    if (hit.ref.kind === 'enemy') damageEnemy(G, hit.ref.e, 34);
    else if (hit.ref.kind === 'ped') {
      hit.ref.p.state = 'flee';
      hit.ref.p.fleeT = 5;
      G.police.addWanted(G, 1);
      G.hud.showToast(G, 'You hit a pedestrian! The police are coming.');
    }
  }
}

export function playerMelee(G) {
  if (G.state !== 'playing' || G.player.car) return;
  const pp = G.player.mesh.position;
  const fx = Math.sin(G.player.mesh.rotation.y);
  const fz = Math.cos(G.player.mesh.rotation.y);
  for (const e of G.combat.enemies) {
    if (e.dead) continue;
    const dx = e.mesh.position.x - pp.x;
    const dz = e.mesh.position.z - pp.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.3 && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.3) {
      damageEnemy(G, e, 50);
      e.mesh.position.x += (dx / d) * 1.5;
      e.mesh.position.z += (dz / d) * 1.5;
      G.audio.hit();
    }
  }
}

export function damageEnemy(G, e, dmg) {
  if (e.dead) return;
  e.hp -= dmg;
  e.flashT = 0.12;
  e.mesh.traverse((o) => {
    if (o.material && o.material.emissive) o.material.emissive.setHex(0x660000);
  });
  if (e.hp <= 0) {
    e.dead = true;
    e.deadT = 3;
    e.mesh.rotation.x = -Math.PI / 2;
    e.mesh.position.y = 0.3;
  }
}

export function updateCombat(G, dt) {
  for (const e of G.combat.enemies) {
    if (e.dead) {
      e.deadT -= dt;
      if (e.deadT <= 0) G.scene.remove(e.mesh);
      continue;
    }
    if (e.flashT > 0) {
      e.flashT -= dt;
      if (e.flashT <= 0) {
        e.mesh.traverse((o) => {
          if (o.material && o.material.emissive) o.material.emissive.setHex(0x000000);
        });
      }
    }
    const pp = G.player.mesh.position;
    const ep = e.mesh.position;
    const d = Math.hypot(pp.x - ep.x, pp.z - ep.z);
    if (G.state === 'playing' && d < 48) {
      e.mesh.rotation.y = Math.atan2(pp.x - ep.x, pp.z - ep.z);
      if (d > 22) {
        ep.x += Math.sin(e.mesh.rotation.y) * 3.2 * dt;
        ep.z += Math.cos(e.mesh.rotation.y) * 3.2 * dt;
        e.walkPhase += dt * 6;
        const s = Math.sin(e.walkPhase) * 0.4;
        e.mesh.userData.legL.rotation.x = s;
        e.mesh.userData.legR.rotation.x = -s;
      }
      e.cooldown -= dt;
      if (e.cooldown <= 0 && d < 45) {
        e.cooldown = rand(1.1, 1.9);
        const from = ep.clone();
        from.y = 1.3;
        const hitChance = clamp(0.34 - d * 0.004, 0.08, 0.34);
        const to = pp.clone();
        to.y = 1.2;
        const hits = Math.random() < hitChance;
        if (!hits) {
          to.x += rand(-2, 2);
          to.z += rand(-1, 1);
        }
        spawnTracer(G, from, to);
        G.audio.shot();
        if (hits) damagePlayer(G, rand(7, 12));
      }
    }
  }
  G.combat.enemies = G.combat.enemies.filter((e) => !e.dead || e.deadT > 0);
  for (const pk of G.combat.packs) {
    if (pk.taken) continue;
    pk.mesh.rotation.y += dt * 1.5;
    pk.mesh.position.y = 0.9 + Math.sin(G.time * 2 + pk.mesh.position.x) * 0.1;
    const pp = G.player.mesh.position;
    if (!G.player.car && Math.hypot(pp.x - pk.mesh.position.x, pp.z - pk.mesh.position.z) < 2) {
      pk.taken = true;
      G.scene.remove(pk.mesh);
      healPlayer(G, 40);
      G.audio.pickup();
      G.hud.showToast(G, '+40 Health');
    }
  }
}
