export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    mouseDown: false,
    locked: false,
    isDown(code) { return this.keys.has(code); },
    wasPressed(code) { return this.pressed.has(code); },
    endFrame() {
      this.pressed.clear();
      this.mouseDX = 0;
      this.mouseDY = 0;
    },
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    input.pressed.add(e.code);
    if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (input.locked) {
      input.mouseDX += e.movementX;
      input.mouseDY += e.movementY;
    }
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    if (e.button === 0 && !input.locked) {
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (_) { /* pointer lock unavailable */ }
    }
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}
