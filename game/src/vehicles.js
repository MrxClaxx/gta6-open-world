import * as THREE from '../vendor/three.module.min.js';
import { rand, randInt, choice, clamp } from './util.js';
import { ROAD_COORDS } from './city.js';
import { spawnFleeingPed } from './pedestrians.js';

const CAR_COLORS = [0xc0392b, 0x2980b9, 0xf1c40f, 0x7f8c8d, 0x2ecc71, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x1abc9c, 0x34495e];

export function makeCarMesh(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.2), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), new THREE.MeshLambertMaterial({ color: 0x223344 }));
  cabin.position.set(0, 1.05, -0.25);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    g.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff6c0, emissive: 0x554411 });
  for (const x of [-0.6, 0.6]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), lightMat);
    l.position.set(x, 0.62, 2.12);
    g.add(l);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xaa1111, emissive: 0x330000 });
  for (const x of [-0.6, 0.6]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.08), tailMat);
    l.position.set(x, 0.62, -2.12);
    g.add(l);
  }
  g.userData.wheels = wheels;
  return g;
}

function makeCarRecord(G, x, z, heading, color, traffic) {
  const mesh = makeCarMesh(color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  return {
    mesh, speed: 0, heading, color, traffic,
    axis: 'x', dir: 1, targetSpeed: 10, turnCooldown: 0,
    driver: true, isPolice: false,
  };
}

export function createVehicles(G) {
  G.cars = [];
  for (let i = 0; i < 9; i++) {
    const axis = Math.random() < 0.5 ? 'x' : 'z';
    const road = ROAD_COORDS[randInt(0, ROAD_COORDS.length - 1)];
    const along = rand(-130, 130);
    const dir = Math.random() < 0.5 ? 1 : -1;
    let x, z, heading;
    if (axis === 'x') {
      x = along; z = road + dir * 7.8;
      heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = road + dir * -7.8; z = along;
      heading = dir > 0 ? 0 : Math.PI;
    }
    const car = makeCarRecord(G, x, z, heading, choice(CAR_COLORS), false);
    car.driver = false;
    G.cars.push(car);
  }
  for (let i = 0; i < 11; i++) {
    const axis = Math.random() < 0.5 ? 'x' : 'z';
    const road = ROAD_COORDS[randInt(0, ROAD_COORDS.length - 1)];
    const along = rand(-135, 135);
    const dir = Math.random() < 0.5 ? 1 : -1;
    let x, z, heading;
    if (axis === 'x') {
      x = along; z = road + (dir > 0 ? 3 : -3);
      heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = road + (dir > 0 ? -3 : 3); z = along;
      heading = dir > 0 ? 0 : Math.PI;
    }
    const car = makeCarRecord(G, x, z, heading, choice(CAR_COLORS), true);
    car.axis = axis;
    car.dir = dir;
    car.targetSpeed = rand(8, 13);
    car.turnCooldown = rand(1, 3);
    G.cars.push(car);
  }
}

function maybeTurn(G, car) {
  const pos = car.mesh.position;
  if (car.axis === 'x') {
    for (const xc of ROAD_COORDS) {
      if (Math.abs(pos.x - xc) < 1.4) {
        if (Math.random() < 0.3) {
          const ndir = Math.random() < 0.5 ? 1 : -1;
          car.axis = 'z';
          car.dir = ndir;
          car.heading = ndir > 0 ? 0 : Math.PI;
          pos.x = xc + (ndir > 0 ? -3 : 3);
          car.turnCooldown = 4;
        } else {
          car.turnCooldown = 1.5;
        }
        break;
      }
    }
  } else {
    for (const zc of ROAD_COORDS) {
      if (Math.abs(pos.z - zc) < 1.4) {
        if (Math.random() < 0.3) {
          const ndir = Math.random() < 0.5 ? 1 : -1;
          car.axis = 'x';
          car.dir = ndir;
          car.heading = ndir > 0 ? Math.PI / 2 : -Math.PI / 2;
          pos.z = zc + (ndir > 0 ? 3 : -3);
          car.turnCooldown = 4;
        } else {
          car.turnCooldown = 1.5;
        }
        break;
      }
    }
  }
}

export function updateVehicles(G, dt) {
  for (const car of G.cars) {
    if (!car.traffic) continue;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    let blocked = false;
    for (const other of G.cars) {
      if (other === car) continue;
      const dx = other.mesh.position.x - car.mesh.position.x;
      const dz = other.mesh.position.z - car.mesh.position.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 11 && side < 2.6) { blocked = true; break; }
    }
    const target = blocked ? 0 : car.targetSpeed;
    car.speed += clamp(target - car.speed, -14 * dt, 8 * dt);
    car.mesh.position.x += fx * car.speed * dt;
    car.mesh.position.z += fz * car.speed * dt;
    car.mesh.rotation.y = car.heading;
    if (car.turnCooldown > 0) car.turnCooldown -= dt;
    else maybeTurn(G, car);
    const pos = car.mesh.position;
    if (Math.abs(pos.x) > 145 || Math.abs(pos.z) > 145) {
      car.heading += Math.PI;
      car.dir *= -1;
      if (car.axis === 'x') pos.z = G.city.nearestRoad(pos.z) + (car.dir > 0 ? 3 : -3);
      else pos.x = G.city.nearestRoad(pos.x) + (car.dir > 0 ? -3 : 3);
      pos.x = clamp(pos.x, -142, 142);
      pos.z = clamp(pos.z, -142, 142);
      car.turnCooldown = 3;
    }
    for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt / 0.36;
  }

  const pc = G.player.car;
  if (pc) {
    const inp = G.input;
    const maxF = 38;
    const maxR = 12;
    const steer = (inp.isDown('KeyD') ? 1 : 0) - (inp.isDown('KeyA') ? 1 : 0);
    const autoGas = G.shot === 2 || G.shot === 3;
    if (autoGas) {
      if (pc.speed < 14) pc.speed += 12 * dt;
      else if (pc.speed > 14) pc.speed -= 8 * dt;
    }
    if (inp.isDown('KeyW')) pc.speed += 15 * dt;
    if (inp.isDown('KeyS')) {
      if (pc.speed > 0.5) pc.speed -= 26 * dt;
      else pc.speed -= 9 * dt;
    }
    if (inp.isDown('Space')) pc.speed -= Math.sign(pc.speed) * 30 * dt;
    if (!inp.isDown('KeyW') && !inp.isDown('KeyS') && !autoGas) pc.speed -= Math.sign(pc.speed) * 5 * dt;
    if (Math.abs(pc.speed) < 0.15 && !inp.isDown('KeyW') && !inp.isDown('KeyS') && !autoGas) pc.speed = 0;
    pc.speed = clamp(pc.speed, -maxR, maxF);
    const turnRate = steer * clamp(pc.speed / 9, -1, 1) * 1.9;
    pc.heading -= turnRate * dt;
    const fx = Math.sin(pc.heading);
    const fz = Math.cos(pc.heading);
    pc.mesh.position.x += fx * pc.speed * dt;
    pc.mesh.position.z += fz * pc.speed * dt;
    pc.mesh.rotation.y = pc.heading;
    const cc = G.city.collide(pc.mesh.position.x, pc.mesh.position.z, 2.1);
    if (cc[0] !== pc.mesh.position.x || cc[1] !== pc.mesh.position.z) pc.speed *= 0.55;
    pc.mesh.position.x = cc[0];
    pc.mesh.position.z = cc[1];
    for (const w of pc.mesh.userData.wheels) w.rotation.x += pc.speed * dt / 0.36;
    pc.mesh.rotation.z = -steer * clamp(pc.speed / maxF, -1, 1) * 0.04;
    if (inp.wasPressed('KeyE')) exitCar(G);
    for (const ped of G.peds) {
      if (Math.hypot(ped.mesh.position.x - pc.mesh.position.x, ped.mesh.position.z - pc.mesh.position.z) < 2.0
        && Math.abs(pc.speed) > 3 && (!ped.hitT || G.time - ped.hitT > 3)) {
        ped.hitT = G.time;
        ped.state = 'flee';
        ped.fleeT = 6;
        G.police.addWanted(G, 1);
        G.hud.showToast(G, 'You ran over a pedestrian!');
        pc.speed *= 0.7;
      }
    }
  }

  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      const a = G.cars[i];
      const b = G.cars[j];
      const dx = b.mesh.position.x - a.mesh.position.x;
      const dz = b.mesh.position.z - a.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 3.6) {
        const push = (3.6 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.mesh.position.x -= nx * push;
        a.mesh.position.z -= nz * push;
        b.mesh.position.x += nx * push;
        b.mesh.position.z += nz * push;
        a.speed *= 0.9;
        b.speed *= 0.9;
      }
    }
  }
}

export function tryEnterCar(G) {
  if (G.player.car) return;
  const pp = G.player.mesh.position;
  let best = null;
  let bestD = 4.2;
  for (const car of G.cars) {
    const d = Math.hypot(car.mesh.position.x - pp.x, car.mesh.position.z - pp.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (!best) return;
  if (best.driver) {
    best.driver = false;
    spawnFleeingPed(G, best.mesh.position.x + 2, best.mesh.position.z + 1);
    G.police.addWanted(G, 1);
    G.hud.showToast(G, 'You stole the car! Wanted level up.');
  }
  putPlayerInCar(G, best);
}

export function putPlayerInCar(G, car) {
  car.traffic = false;
  G.player.car = car;
  G.player.mesh.visible = false;
  G.audio.setEngine(true, 0.2);
}

export function exitCar(G) {
  const car = G.player.car;
  if (!car) return;
  const rx = -Math.cos(car.heading);
  const rz = Math.sin(car.heading);
  G.player.mesh.position.set(car.mesh.position.x + rx * 2.6, 0, car.mesh.position.z + rz * 2.6);
  G.player.mesh.visible = true;
  G.player.mesh.rotation.y = car.heading;
  car.speed = 0;
  G.player.car = null;
  G.audio.setEngine(false, 0);
}
