import * as THREE from '../vendor/three.module.min.js';
import { fmtMoney } from './util.js';
import { spawnEnemy, spawnHealthPack } from './combat.js';
import { setWanted } from './police.js';

const MISSIONS = [
  {
    id: 1, title: 'First Wheels', reward: 300,
    brief: 'Mara Kline: "Welcome to Solmar Bay, kid. First rule: wheels are everything. Steal any car on the street, then bring it to the marker. Don\'t get caught."',
    objective: 'Steal a car, then drive to the marker',
  },
  {
    id: 2, title: 'Courier Run', reward: 500,
    brief: 'Mara Kline: "A package is waiting at the marina. Pick it up and deliver it across town. You have 90 seconds — the client hates waiting."',
    objective: 'Pick up the package at the marina, then deliver it',
  },
  {
    id: 3, title: 'Harbor Trouble', reward: 800,
    brief: 'Mara Kline: "A rival crew is holding my crate at the harbor. Four of them, all armed. Take them down, grab the crate, and try not to die."',
    objective: 'Clear the harbor crew and take the crate',
  },
  {
    id: 4, title: 'Hot Pursuit', reward: 700,
    brief: 'Mara Kline: "The cops are onto you — three stars and climbing. Lose them and get to the safehouse on the west side. Drive like your life depends on it."',
    objective: 'Reach the safehouse with the police on your tail',
  },
  {
    id: 5, title: 'Bay Finale', reward: 1500,
    brief: 'Mara Kline: "This is it. The whole crew is waiting at the plaza. Finish this, get to the marina, and Solmar Bay is yours."',
    objective: 'Defeat the plaza crew, then escape to the marina',
  },
];

export function createMissions(G) {
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd23f, transparent: true, opacity: 0.28,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 20, 1, true), beaconMat);
  beacon.position.y = 15;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 2.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  const grp = new THREE.Group();
  grp.add(beacon);
  grp.add(ring);
  grp.visible = false;
  G.scene.add(grp);
  G.missions = {
    list: MISSIONS,
    index: 0,
    stage: 0,
    timer: 0,
    done: false,
    beacon: grp,
    marker: new THREE.Vector3(),
    onBusted,
  };
  return G.missions;
}

function setMarker(G, x, z) {
  G.missions.marker.set(x, 0, z);
  G.missions.beacon.position.set(x, 0, z);
  G.missions.beacon.visible = true;
}

export function startMission(G, i) {
  const M = G.missions;
  M.index = i;
  M.stage = 0;
  M.timer = 0;
  M.done = false;
  const m = MISSIONS[i];
  if (i === 0) setMarker(G, 69, 69);
  else if (i === 1) setMarker(G, G.city.marina.x, G.city.marina.z);
  else if (i === 2) setMarker(G, G.city.harbor.x, G.city.harbor.z);
  else if (i === 3) {
    setMarker(G, G.city.safehouse.x, G.city.safehouse.z);
    setWanted(G, 3);
  } else if (i === 4) setMarker(G, 0, 0);
  G.hud.showBriefing(G, 'Mission ' + m.id + ' — ' + m.title, m.brief, () => {});
  G.hud.showToast(G, 'Mission ' + m.id + ': ' + m.title);
}

export function objectiveText(G) {
  const M = G.missions;
  if (M.done) return 'All missions complete — Solmar Bay is yours!';
  const m = MISSIONS[M.index];
  if (M.index === 0) return M.stage === 0 ? 'Steal a car (press E near one)' : 'Drive to the marker';
  if (M.index === 1) return M.stage === 0 ? 'Pick up the package at the marina' : 'Deliver the package — ' + Math.ceil(M.timer) + 's left';
  if (M.index === 2) {
    if (M.stage === 0) return 'Reach the harbor';
    if (M.stage === 1) return 'Defeat the harbor crew (' + aliveEnemies(G) + ' left)';
    return 'Take the crate';
  }
  if (M.index === 3) return 'Reach the safehouse — lose the cops!';
  if (M.index === 4) {
    if (M.stage === 0) return 'Reach the plaza';
    if (M.stage === 1) return 'Defeat the plaza crew (' + aliveEnemies(G) + ' left)';
    return 'Escape to the marina';
  }
  return m.objective;
}

function aliveEnemies(G) {
  return G.combat.enemies.filter((e) => !e.dead).length;
}

function near(G, x, z, r) {
  const p = G.player.mesh.position;
  return Math.hypot(p.x - x, p.z - z) < r;
}

function completeMission(G) {
  const M = G.missions;
  const m = MISSIONS[M.index];
  G.player.money += m.reward;
  G.audio.missionDone();
  G.hud.showToast(G, 'Mission complete! +' + fmtMoney(m.reward));
  M.beacon.visible = false;
  if (M.index + 1 >= MISSIONS.length) {
    M.done = true;
    G.hud.showComplete(G);
    G.saveGame();
    return;
  }
  startMission(G, M.index + 1);
  G.saveGame();
}

function failMission(G, reason) {
  G.hud.showToast(G, 'Mission failed: ' + reason + ' — try again');
  G.audio.busted();
  startMission(G, G.missions.index);
}

export function onBusted(G) {
  if (!G.missions.done) failMission(G, 'busted by the police');
}

export function updateMissions(G, dt) {
  const M = G.missions;
  if (M.done || G.state !== 'playing') return;
  M.beacon.rotation.y += dt * 0.8;
  const s = 1 + Math.sin(G.time * 3) * 0.08;
  M.beacon.scale.set(s, 1, s);
  const i = M.index;
  if (i === 0) {
    if (M.stage === 0 && G.player.car) {
      M.stage = 1;
      G.hud.showToast(G, 'Nice wheels. Now drive to the marker.');
    } else if (M.stage === 1 && near(G, 69, 69, 9)) {
      completeMission(G);
    }
  } else if (i === 1) {
    if (M.stage === 0 && near(G, G.city.marina.x, G.city.marina.z, 6)) {
      M.stage = 1;
      M.timer = 90;
      setMarker(G, G.city.courierDrop.x, G.city.courierDrop.z);
      G.hud.showToast(G, 'Package picked up! 90 seconds — go!');
      G.audio.pickup();
    } else if (M.stage === 1) {
      M.timer -= dt;
      if (near(G, G.city.courierDrop.x, G.city.courierDrop.z, 7)) completeMission(G);
      else if (M.timer <= 0) failMission(G, 'delivery too slow');
    }
  } else if (i === 2) {
    if (M.stage === 0 && near(G, G.city.harbor.x, G.city.harbor.z, 14)) {
      M.stage = 1;
      const spots = [[100, -116], [118, -116], [100, -128], [124, -128]];
      for (const [x, z] of spots) spawnEnemy(G, x, z);
      spawnHealthPack(G, 108, 0, -122);
      G.hud.showToast(G, 'Ambush! Four armed crew at the harbor.');
    } else if (M.stage === 1 && aliveEnemies(G) === 0) {
      M.stage = 2;
      setMarker(G, G.city.harbor.x, G.city.harbor.z);
      G.hud.showToast(G, 'Crew down. Grab the crate!');
    } else if (M.stage === 2 && near(G, G.city.harbor.x, G.city.harbor.z, 5)) {
      completeMission(G);
    }
  } else if (i === 3) {
    if (near(G, G.city.safehouse.x, G.city.safehouse.z, 9)) {
      setWanted(G, 0);
      completeMission(G);
    }
  } else if (i === 4) {
    if (M.stage === 0 && near(G, 0, 0, 12)) {
      M.stage = 1;
      const spots = [[-8, -8], [8, -8], [-8, 8], [8, 8], [0, -14], [0, 14]];
      for (const [x, z] of spots) spawnEnemy(G, x, z);
      G.hud.showToast(G, 'The whole crew is here. Finish this!');
    } else if (M.stage === 1 && aliveEnemies(G) === 0) {
      M.stage = 2;
      setMarker(G, G.city.escapePoint.x, G.city.escapePoint.z);
      G.hud.showToast(G, 'Plaza clear. Escape to the marina!');
    } else if (M.stage === 2 && near(G, G.city.escapePoint.x, G.city.escapePoint.z, 8)) {
      completeMission(G);
    }
  }
}
