/**
 * Unified keyboard + pointer + touch input.
 * Exposes: keys set, drag deltas per frame, zoom delta, pressed-edge
 * events, pointer-lock look deltas, and lock state.
 */
export function createInput(renderer) {
  const keys = new Set();
  const pressedEdge = new Set();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let dragDX = 0;
  let dragDY = 0;
  let zoomDelta = 0;
  let lastPinch = 0;
  let locked = false;
  let lockAccX = 0;
  let lockAccY = 0;

  const el = renderer.domElement;

  window.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]') || /^(BUTTON|INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (!keys.has(e.code)) pressedEdge.add(e.code);
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('focusin', (e) => {
    if (/^(BUTTON|INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) keys.clear();
  });

  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    if (e.isTrusted && e.pointerId !== undefined) el.setPointerCapture?.(e.pointerId);
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dragDX += e.clientX - lastX;
    dragDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });
  el.addEventListener('wheel', (e) => {
    zoomDelta += e.deltaY;
  }, { passive: true });

  // pointer lock (third-person walking): the app decides when to grab
  el.addEventListener('click', () => {
    if (window.__wantPointerLock) el.requestPointerLock?.()?.catch?.(() => {});
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === el;
    window.__pointerLocked = locked;
  });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    lockAccX += e.movementX;
    lockAccY += e.movementY;
  });

  el.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      if (lastPinch) zoomDelta += (lastPinch - d) * 2;
      lastPinch = d;
    }
  }, { passive: true });
  el.addEventListener('touchend', () => { lastPinch = 0; });

  const api = {
    get dragDX() { return dragDX; },
    get dragDY() { return dragDY; },
    get zoomDelta() { return zoomDelta; },
    get dragging() { return dragging; },
    get locked() { return locked; },
    /** mouse-look deltas: pointer-locked movement, else drag */
    get lookDX() { return locked ? lockAccX : dragDX; },
    get lookDY() { return locked ? lockAccY : dragDY; },
    isDown(code) { return keys.has(code); },
    wasPressed(code) { return pressedEdge.has(code); },
    requestLock() { el.requestPointerLock?.(); },
    exitLock() { if (locked) document.exitPointerLock?.(); },
    consumeFrame() {
      dragDX = 0;
      dragDY = 0;
      zoomDelta = 0;
      lockAccX = 0;
      lockAccY = 0;
      pressedEdge.clear();
    },
  };
  return api;
}
