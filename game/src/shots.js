import * as THREE from '../vendor/three.module.min.js';

export function createShots(G) {
  G.shots = { pool: [], group: new THREE.Group() };
  G.scene.add(G.shots.group);
}

export function spawnTracer(G, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 });
  const line = new THREE.Line(geo, mat);
  G.shots.group.add(line);
  G.shots.pool.push({ line, life: 0.09 });
  if (G.shots.pool.length > 24) {
    const old = G.shots.pool.shift();
    G.shots.group.remove(old.line);
    old.line.geometry.dispose();
    old.line.material.dispose();
  }
}

export function updateShots(G, dt) {
  for (let i = G.shots.pool.length - 1; i >= 0; i--) {
    const t = G.shots.pool[i];
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.95;
    if (t.life <= 0) {
      G.shots.group.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      G.shots.pool.splice(i, 1);
    }
  }
}
