import { fmtMoney, fmtClock } from './util.js';
import { ROAD_COORDS } from './city.js';
import { objectiveText } from './missions.js';
import { loadSave } from './save.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  G.hud = {
    mm: $('minimap').getContext('2d'),
    toastTimer: 0,
    briefCb: null,
    showToast,
    showBriefing,
    showBusted,
    showComplete,
    el: {
      healthFill: $('health-fill'),
      healthText: $('health-text'),
      money: $('money'),
      stars: $('stars'),
      clock: $('clock'),
      speed: $('speed'),
      speedVal: $('speed-val'),
      objectiveText: $('objective-text'),
      toast: $('toast'),
      crosshair: $('crosshair'),
    },
  };
  $('btn-new').addEventListener('click', () => {
    G.audio.unlock();
    G.audio.click();
    G.startNewGame();
  });
  const contBtn = $('btn-continue');
  const save = loadSave();
  contBtn.disabled = !save;
  if (save) contBtn.textContent = 'Continue — Mission ' + ((save.missionIndex || 0) + 1);
  contBtn.addEventListener('click', () => {
    G.audio.unlock();
    G.audio.click();
    G.startContinueGame();
  });
  $('btn-resume').addEventListener('click', () => {
    G.audio.click();
    G.setPaused(false);
  });
  $('btn-restart').addEventListener('click', () => {
    G.audio.click();
    G.setPaused(false);
    G.startNewGame();
  });
  $('btn-briefing').addEventListener('click', () => {
    G.audio.click();
    hide('briefing');
    if (G.hud.briefCb) {
      const cb = G.hud.briefCb;
      G.hud.briefCb = null;
      cb();
    }
  });
  $('btn-busted').addEventListener('click', () => {
    G.audio.click();
    hide('busted');
  });
  $('btn-complete').addEventListener('click', () => {
    G.audio.click();
    hide('complete');
  });
}

function show(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function hide(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

export function showMenu(G) { show('menu'); }

export function hideMenu(G) { hide('menu'); }

export function showBriefing(G, title, body, cb) {
  if (G.shot) {
    if (cb) cb();
    return;
  }
  document.getElementById('briefing-title').textContent = title;
  document.getElementById('briefing-body').textContent = body;
  G.hud.briefCb = cb || null;
  show('briefing');
}

export function showToast(G, msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  G.hud.toastTimer = 4;
}

export function showBusted(G, fine) {
  document.getElementById('busted-text').textContent =
    'Busted! The Solmar Bay PD caught you. Fine: ' + fmtMoney(fine) + '.';
  show('busted');
}

export function showComplete(G) {
  document.getElementById('complete-text').textContent =
    'You finished all five missions and own the streets of Solmar Bay. Final cash: ' + fmtMoney(G.player.money) + '.';
  show('complete');
}

export function updateHud(G, dt) {
  const el = G.hud.el;
  el.healthFill.style.width = Math.max(0, G.player.health) + '%';
  el.healthText.textContent = String(Math.ceil(Math.max(0, G.player.health)));
  el.money.textContent = fmtMoney(G.player.money);
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < G.police.wanted ? '★' : '☆';
  el.stars.textContent = stars;
  el.stars.style.color = G.police.wanted > 0 ? '#ffd23f' : '#888888';
  el.clock.textContent = fmtClock(G.gameMinutes);
  if (G.player.car) {
    el.speed.classList.remove('hidden');
    el.speedVal.textContent = String(Math.round(Math.abs(G.player.car.speed) * 3.6));
  } else {
    el.speed.classList.add('hidden');
  }
  el.objectiveText.textContent = G.missions ? objectiveText(G) : '';
  el.crosshair.style.display = G.player.car ? 'none' : 'block';
  if (G.hud.toastTimer > 0) {
    G.hud.toastTimer -= dt;
    if (G.hud.toastTimer <= 0) el.toast.classList.add('hidden');
  }
  drawMinimap(G);
}

function drawMinimap(G) {
  const ctx = G.hud.mm;
  if (!ctx) return;
  const S = 200;
  const W = 320;
  const toX = (x) => ((x + 160) / W) * S;
  const toY = (z) => ((z + 160) / W) * S;
  ctx.fillStyle = '#0e1a24';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#1c5f8a';
  ctx.fillRect(toX(165), 0, S - toX(165), S);
  ctx.fillStyle = '#cbb37a';
  ctx.fillRect(toX(160), 0, toX(165) - toX(160), S);
  ctx.strokeStyle = '#5a6068';
  ctx.lineWidth = 5;
  for (const c of ROAD_COORDS) {
    ctx.beginPath();
    ctx.moveTo(toX(-150), toY(c));
    ctx.lineTo(toX(150), toY(c));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(toX(c), toY(-150));
    ctx.lineTo(toX(c), toY(150));
    ctx.stroke();
  }
  ctx.fillStyle = '#8a7f66';
  ctx.beginPath();
  ctx.arc(toX(0), toY(0), 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b5a44';
  ctx.fillRect(toX(92), toY(-138), toX(138) - toX(92), toY(-92) - toY(-138));
  if (G.missions && G.missions.beacon.visible) {
    const mx = toX(G.missions.marker.x);
    const my = toY(G.missions.marker.z);
    const r = 6 + Math.sin(G.time * 4) * 2;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, r + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  for (const c of G.cars) {
    ctx.fillRect(toX(c.mesh.position.x) - 1.5, toY(c.mesh.position.z) - 1.5, 3, 3);
  }
  ctx.fillStyle = '#ff7733';
  for (const e of G.combat.enemies) {
    if (e.dead) continue;
    ctx.beginPath();
    ctx.arc(toX(e.mesh.position.x), toY(e.mesh.position.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff3355';
  for (const c of G.police.copCars) {
    ctx.beginPath();
    ctx.arc(toX(c.mesh.position.x), toY(c.mesh.position.z), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of G.police.footCops) {
    ctx.beginPath();
    ctx.arc(toX(c.mesh.position.x), toY(c.mesh.position.z), 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const px = toX(G.player.mesh.position.x);
  const py = toY(G.player.mesh.position.z);
  const a = G.player.car ? G.player.car.heading : G.player.mesh.rotation.y;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.PI - a);
  ctx.fillStyle = '#2ecc71';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}
