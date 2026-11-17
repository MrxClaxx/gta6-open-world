import { rand, choice, dist2 } from './util.js';
import { makePersonMesh } from './player.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xfd79a8, 0x00cec9];
const SKINS = [0xd9a066, 0x8d5524, 0xffdbac, 0xc68642];

export function createPedestrians(G, count) {
  G.peds = [];
  for (let i = 0; i < count; i++) {
    const pos = G.city.randomSidewalkPoint();
    const mesh = makePersonMesh(choice(SHIRTS), 0x2c3e50, choice(SKINS));
    mesh.position.set(pos.x, 0, pos.z);
    G.scene.add(mesh);
    G.peds.push({
      mesh,
      target: G.city.randomSidewalkPoint(),
      speed: rand(1.4, 2.4),
      state: 'walk',
      fleeT: 0,
      walkPhase: rand(0, 6),
      hitT: -99,
    });
  }
}

export function spawnFleeingPed(G, x, z) {
  const mesh = makePersonMesh(0xe74c3c, 0x2c3e50, 0xd9a066);
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  G.peds.push({
    mesh,
    target: G.city.randomSidewalkPoint(),
    speed: 2.2,
    state: 'flee',
    fleeT: 4,
    walkPhase: 0,
    hitT: -99,
  });
}

export function updatePedestrians(G, dt) {
  for (const ped of G.peds) {
    const pos = ped.mesh.position;
    const shot = G.combat.lastShotPos;
    let flee = false;
    if (shot && G.time - G.combat.lastShotTime < 2 && dist2(pos.x, pos.z, shot.x, shot.z) < 625) flee = true;
    if (!flee) {
      for (const cop of G.police.footCops) {
        if (dist2(pos.x, pos.z, cop.mesh.position.x, cop.mesh.position.z) < 144) { flee = true; break; }
      }
    }
    if (flee) {
      ped.state = 'flee';
      ped.fleeT = 3;
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const ax = pos.x - G.player.mesh.position.x;
      const az = pos.z - G.player.mesh.position.z;
      const l = Math.hypot(ax, az) || 1;
      pos.x += (ax / l) * 5 * dt;
      pos.z += (az / l) * 5 * dt;
      ped.mesh.rotation.y = Math.atan2(ax / l, az / l);
      if (ped.fleeT <= 0) {
        ped.state = 'walk';
        ped.target = G.city.randomSidewalkPoint();
      }
    } else {
      const dx = ped.target.x - pos.x;
      const dz = ped.target.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5) {
        ped.target = G.city.randomSidewalkPoint();
      } else {
        pos.x += (dx / d) * ped.speed * dt;
        pos.z += (dz / d) * ped.speed * dt;
        ped.mesh.rotation.y = Math.atan2(dx / d, dz / d);
      }
    }
    const c = G.city.collide(pos.x, pos.z, 0.6);
    pos.x = c[0];
    pos.z = c[1];
    ped.walkPhase += dt * (ped.state === 'flee' ? 9 : 4);
    const s = Math.sin(ped.walkPhase) * 0.45;
    ped.mesh.userData.legL.rotation.x = s;
    ped.mesh.userData.legR.rotation.x = -s;
    ped.mesh.userData.armL.rotation.x = -s * 0.7;
    ped.mesh.userData.armR.rotation.x = s * 0.7;
  }
}
