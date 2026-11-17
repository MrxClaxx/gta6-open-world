import * as THREE from '../vendor/three.module.min.js';
import { rand, randInt, choice, clamp, TAU } from './util.js';

export const ROAD_COORDS = [-115, -69, -23, 23, 69, 115];
export const ROAD_HALF = 6;
export const CITY_HALF = 150;

const FACADE_COLORS = ['#b98a5e', '#8a9bb0', '#a89a7a', '#7a8a99', '#c0a080', '#93a48a', '#a97e6d'];
const CONTAINER_COLORS = [0xc0392b, 0x2980b9, 0x27ae60, 0xe67e22, 0x8e44ad, 0x16a085];

function facadeTexture(base, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 0, 8, 256);
  g.fillRect(120, 0, 8, 256);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 6; x++) {
      g.fillStyle = Math.random() < litRatio ? '#ffd98a' : '#1d2733';
      g.fillRect(10 + x * 19, 12 + y * 20, 12, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function dashTextureHorizontal() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 8;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 8);
  g.fillStyle = '#f5f0dc';
  g.fillRect(6, 2, 30, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(36, 1);
  return tex;
}

function dashTextureVertical() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 8, 64);
  g.fillStyle = '#f5f0dc';
  g.fillRect(2, 6, 4, 30);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 36);
  return tex;
}

function makePalm() {
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b46 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 5, 6), trunkMat);
  trunk.position.y = 2.5;
  trunk.rotation.z = rand(-0.08, 0.08);
  palm.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
  const top = new THREE.Group();
  top.position.y = 5.1;
  for (let k = 0; k < 6; k++) {
    const geo = new THREE.ConeGeometry(0.55, 2.4, 4);
    geo.translate(0, 1.1, 0);
    const leaf = new THREE.Mesh(geo, leafMat);
    leaf.scale.set(1, 1, 0.35);
    const holder = new THREE.Group();
    holder.rotation.y = (k / 6) * TAU;
    leaf.rotation.x = 2.2;
    holder.add(leaf);
    top.add(holder);
  }
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshLambertMaterial({ color: 0x6b4a2a }));
  nut.position.y = 0.1;
  top.add(nut);
  palm.add(top);
  return palm;
}

export function createCity(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const addCollider = (x0, z0, x1, z1) => colliders.push({ x0, z0, x1, z1 });

  const lambert = (color, opts) => new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {}));

  // Ground, beach and sea.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(330, 330), lambert(0x79a85f));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  group.add(ground);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(20, 330), lambert(0xe6d199));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(175, 0.01, 0);
  group.add(beach);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(500, 420), lambert(0x2f7fb5));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(430, -0.5, 0);
  group.add(sea);

  // Roads, dashes and sidewalks.
  const roadMat = lambert(0x3a3f45);
  const walkMat = lambert(0xb5ad9c);
  const dashH = dashTextureHorizontal();
  const dashV = dashTextureVertical();
  const dashMatH = new THREE.MeshBasicMaterial({ map: dashH, transparent: true, depthWrite: false });
  const dashMatV = new THREE.MeshBasicMaterial({ map: dashV, transparent: true, depthWrite: false });
  for (const c of ROAD_COORDS) {
    const ave = new THREE.Mesh(new THREE.PlaneGeometry(300, 12), roadMat);
    ave.rotation.x = -Math.PI / 2;
    ave.position.set(0, 0.02, c);
    group.add(ave);
    const str = new THREE.Mesh(new THREE.PlaneGeometry(12, 300), roadMat);
    str.rotation.x = -Math.PI / 2;
    str.position.set(c, 0.02, 0);
    group.add(str);
    const dH = new THREE.Mesh(new THREE.PlaneGeometry(300, 0.35), dashMatH);
    dH.rotation.x = -Math.PI / 2;
    dH.position.set(0, 0.03, c);
    group.add(dH);
    const dV = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 300), dashMatV);
    dV.rotation.x = -Math.PI / 2;
    dV.position.set(c, 0.03, 0);
    group.add(dV);
    for (const off of [-7.8, 7.8]) {
      const w1 = new THREE.Mesh(new THREE.BoxGeometry(300, 0.14, 3.6), walkMat);
      w1.position.set(0, 0.07, c + off);
      group.add(w1);
      const w2 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 300), walkMat);
      w2.position.set(c + off, 0.07, 0);
      group.add(w2);
    }
  }

  // Buildings, one to three per block. Plaza (0,0) and harbor yard (92,-92) stay open.
  const blockCenters = [-92, -46, 0, 46, 92];
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      if (bx === 0 && bz === 0) continue;
      if (bx === 92 && bz === -92) continue;
      const count = randInt(1, 2);
      const spots = count === 1 ? [[0, 0]] : [[-8, -8], [8, 8]];
      for (const [ox, oz] of spots) {
        const w = rand(11, 16);
        const d = rand(11, 16);
        const nearCenter = Math.abs(bx) <= 46 && Math.abs(bz) <= 46;
        const h = rand(13, 30) + (nearCenter ? rand(8, 22) : 0);
        const tex = facadeTexture(choice(FACADE_COLORS), 0.35);
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(bx + ox, h / 2, bz + oz);
        group.add(b);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 1.6, d * 0.5), lambert(0x4a4f55));
        roof.position.set(bx + ox, h + 0.8, bz + oz);
        group.add(roof);
        addCollider(bx + ox - w / 2, bz + oz - d / 2, bx + ox + w / 2, bz + oz + d / 2);
      }
    }
  }

  // Central plaza with fountain.
  const paving = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 0.18, 32), lambert(0xc9bda6));
  paving.position.set(0, 0.09, 0);
  group.add(paving);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 0.9, 24), lambert(0x8fa8b5));
  basin.position.set(0, 0.45, 0);
  group.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.2, 24), lambert(0x45a5d8));
  water.position.set(0, 0.85, 0);
  group.add(water);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 2.6, 12), lambert(0xd8d2c2));
  column.position.set(0, 1.6, 0);
  group.add(column);
  addCollider(-5, -5, 5, 5);
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const palm = makePalm();
    palm.position.set(Math.sin(a) * 16, 0, Math.cos(a) * 16);
    group.add(palm);
  }

  // Harbor yard: concrete, containers, crane, mission crates.
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), lambert(0x9a938a));
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(115, 0.015, -115);
  group.add(yard);
  for (let i = 0; i < 10; i++) {
    const cx = 100 + (i % 5) * 7;
    const cz = -100 - Math.floor(i / 5) * 8;
    const cm = lambert(choice(CONTAINER_COLORS));
    const box = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.6), cm);
    box.position.set(cx, 1.3, cz);
    group.add(box);
    addCollider(cx - 3, cz - 1.3, cx + 3, cz + 1.3);
    if (i % 3 === 0) {
      const top = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.6), lambert(choice(CONTAINER_COLORS)));
      top.position.set(cx, 3.9, cz);
      group.add(top);
    }
  }
  const craneMat = lambert(0xd8a020);
  for (const lx of [126, 131]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1, 14, 1), craneMat);
    leg.position.set(lx, 7, -128);
    group.add(leg);
    addCollider(lx - 0.5, -128.5, lx + 0.5, -127.5);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(11, 1, 1), craneMat);
  beam.position.set(128.5, 14, -128);
  group.add(beam);
  const crateMat = lambert(0x9a7b4f);
  for (const [cx, cz] of [[112, -112], [114.5, -110], [110.5, -114.5]]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), crateMat);
    crate.position.set(cx, 0.65, cz);
    crate.rotation.y = rand(0, 1);
    group.add(crate);
  }

  // Marina docks and boats.
  const dockMat = lambert(0x7a5c38);
  for (const dz of [-60, -20, 20]) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(22, 0.5, 2.5), dockMat);
    dock.position.set(196, 0.25, dz);
    group.add(dock);
  }
  for (const [bx, bz] of [[204, -64], [204, -16], [204, 24], [210, -40]]) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 2.6), lambert(0xf0f0f0));
    hull.position.set(bx, 0.4, bz);
    group.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1, 2), lambert(0x2e86c1));
    cabin.position.set(bx - 0.5, 1.4, bz);
    group.add(cabin);
  }

  // Palm trees along the beach and marina.
  for (let z = -130; z <= 130; z += 22) {
    const palm = makePalm();
    palm.position.set(170, 0, z);
    group.add(palm);
  }
  for (const [px, pz] of [[168, -70], [168, 30]]) {
    const palm = makePalm();
    palm.position.set(px, 0, pz);
    group.add(palm);
  }

  // Street lamps on alternating intersections.
  const poleMat = lambert(0x2c2f33);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xcc9900 });
  let li = 0;
  for (const ix of ROAD_COORDS) {
    for (const iz of ROAD_COORDS) {
      li++;
      if (li % 2 !== 0) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.5, 6), poleMat);
      pole.position.set(ix + 7.5, 2.75, iz + 7.5);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), lampMat);
      bulb.position.set(ix + 7.5, 5.6, iz + 7.5);
      group.add(bulb);
    }
  }

  function nearestRoad(v) {
    let best = ROAD_COORDS[0];
    for (const c of ROAD_COORDS) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
    return best;
  }

  const city = {
    group,
    colliders,
    bounds: 160,
    plaza: new THREE.Vector3(0, 0, 0),
    harbor: new THREE.Vector3(112, 0, -112),
    marina: new THREE.Vector3(150, 0, -40),
    beach: new THREE.Vector3(150, 0, 60),
    safehouse: new THREE.Vector3(-115, 0, 115),
    courierDrop: new THREE.Vector3(-115, 0, -69),
    escapePoint: new THREE.Vector3(150, 0, 40),
    nearestRoad,
    isOnRoad(x, z) {
      for (const c of ROAD_COORDS) {
        if (Math.abs(z - c) < ROAD_HALF || Math.abs(x - c) < ROAD_HALF) return true;
      }
      return false;
    },
    randomRoadPoint() {
      const axis = Math.random() < 0.5 ? 'x' : 'z';
      const road = ROAD_COORDS[randInt(0, ROAD_COORDS.length - 1)];
      const along = rand(-135, 135);
      if (axis === 'x') return new THREE.Vector3(along, 0, road);
      return new THREE.Vector3(road, 0, along);
    },
    randomSidewalkPoint() {
      const axis = Math.random() < 0.5 ? 'x' : 'z';
      const road = ROAD_COORDS[randInt(0, ROAD_COORDS.length - 1)];
      const along = rand(-140, 140);
      const off = (Math.random() < 0.5 ? -1 : 1) * 7.8;
      if (axis === 'x') return new THREE.Vector3(along, 0, road + off);
      return new THREE.Vector3(road + off, 0, along);
    },
    collide(x, z, r) {
      let nx = x;
      let nz = z;
      for (const c of colliders) {
        if (nx + r > c.x0 && nx - r < c.x1 && nz + r > c.z0 && nz - r < c.z1) {
          const pushL = nx + r - c.x0;
          const pushR = c.x1 - (nx - r);
          const pushU = nz + r - c.z0;
          const pushD = c.z1 - (nz - r);
          const m = Math.min(pushL, pushR, pushU, pushD);
          if (m === pushL) nx = c.x0 - r;
          else if (m === pushR) nx = c.x1 + r;
          else if (m === pushU) nz = c.z0 - r;
          else nz = c.z1 + r;
        }
      }
      nx = clamp(nx, -158, 182);
      nz = clamp(nz, -158, 158);
      return [nx, nz];
    },
  };
  return city;
}
