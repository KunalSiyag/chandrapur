// Collision for the walkable town: axis-aligned boxes and circles.
// Builders register what they place; the player resolves against
// the list. Terrain rules (deep water) live in layout.js.

export const boxes = [];   // {x0, z0, x1, z1}
export const circles = []; // {cx, cz, r}
export const oriented = []; // facade-aligned parcels; an AABB would block crooked lanes

export function addOrientedBox(cx, cz, hx, hz, yaw = 0, baseY = 0) {
  const b = { cx, cz, hx, hz, yaw, baseY, cos: Math.cos(yaw), sin: Math.sin(yaw) };
  oriented.push(b); return b;
}

export function addBoxRect(x0, z0, x1, z1) {
  boxes.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
}
export function addBox(cx, cz, hx, hz) { addBoxRect(cx - hx, cz - hz, cx + hx, cz + hz); }
export function addCircle(cx, cz, r) { const c = { cx, cz, r }; circles.push(c); return c; }

export function blockersAt(x, z, radius = 0.34) {
  const out = [];
  for (const b of oriented) {
    const dx = x - b.cx, dz = z - b.cz, lx = b.cos * dx - b.sin * dz, lz = b.sin * dx + b.cos * dz;
    const ex = lx - Math.max(-b.hx, Math.min(lx, b.hx)), ez = lz - Math.max(-b.hz, Math.min(lz, b.hz));
    if (ex * ex + ez * ez < radius * radius) out.push(b.owner ?? 'parcel');
  }
  for (const c of circles) if (Math.hypot(x - c.cx, z - c.cz) < c.r + radius) out.push(c.owner ?? 'circle');
  return out;
}

export function clearColliders() { boxes.length = 0; circles.length = 0; oriented.length = 0; }

export function isBlocked(x, z, radius = 0.34) {
  for (const b of boxes) {
    const dx = x - Math.max(b.x0, Math.min(x, b.x1)), dz = z - Math.max(b.z0, Math.min(z, b.z1));
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  for (const c of circles) if (Math.hypot(x - c.cx, z - c.cz) < c.r + radius) return true;
  for (const b of oriented) {
    const dx = x - b.cx, dz = z - b.cz;
    const lx = b.cos * dx - b.sin * dz, lz = b.sin * dx + b.cos * dz;
    const ex = lx - Math.max(-b.hx, Math.min(lx, b.hx)), ez = lz - Math.max(-b.hz, Math.min(lz, b.hz));
    if (ex * ex + ez * ez < radius * radius) return true;
  }
  return false;
}

/** Push a point (with radius) out of every collider it overlaps. */
export function resolveXZ(p, radius = 0.35) {
  for (let iter = 0; iter < 2; iter++) {
    for (const b of oriented) {
      const dx = p.x - b.cx, dz = p.z - b.cz;
      let x = b.cos * dx - b.sin * dz, z = b.sin * dx + b.cos * dz;
      const nx = Math.max(-b.hx, Math.min(x, b.hx)), nz = Math.max(-b.hz, Math.min(z, b.hz));
      const ex = x - nx, ez = z - nz, d2 = ex * ex + ez * ez;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2); x = nx + ex / d * radius; z = nz + ez / d * radius;
      } else {
        const sides = [x + b.hx, b.hx - x, z + b.hz, b.hz - z], min = Math.min(...sides);
        if (sides[0] === min) x = -b.hx - radius;
        else if (sides[1] === min) x = b.hx + radius;
        else if (sides[2] === min) z = -b.hz - radius;
        else z = b.hz + radius;
      }
      p.x = b.cx + b.cos * x + b.sin * z; p.z = b.cz - b.sin * x + b.cos * z;
    }
    for (const b of boxes) {
      const nx = Math.max(b.x0, Math.min(p.x, b.x1));
      const nz = Math.max(b.z0, Math.min(p.z, b.z1));
      const dx = p.x - nx, dz = p.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          p.x = nx + (dx / d) * radius;
          p.z = nz + (dz / d) * radius;
        } else {
          // dead centre — push along the shallowest axis
          const l = p.x - b.x0, r = b.x1 - p.x, t = p.z - b.z0, bt = b.z1 - p.z;
          const m = Math.min(l, r, t, bt);
          if (m === l) p.x = b.x0 - radius;
          else if (m === r) p.x = b.x1 + radius;
          else if (m === t) p.z = b.z0 - radius;
          else p.z = b.z1 + radius;
        }
      }
    }
    for (const c of circles) {
      const dx = p.x - c.cx, dz = p.z - c.cz;
      const rr = c.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = c.cx + (dx / d) * rr;
        p.z = c.cz + (dz / d) * rr;
      }
    }
  }
}

/**
 * After the world is built, collect world-space AABBs from anything
 * flagged `userData.solid`. Instanced meshes and long run-builders
 * (fences, railings, lamp cones) must NOT be flagged — they register
 * their own pieces.
 */
export function collectFromScene(scene, THREE) {
  const box3 = new THREE.Box3();
  scene.traverse((o) => {
    if (o.userData && o.userData.solid && !o.isInstancedMesh) {
      box3.setFromObject(o);
      if (box3.min.x === Infinity) return;
      addBoxRect(box3.min.x, box3.min.z, box3.max.x, box3.max.z);
    }
    if (o.userData && o.userData.solidCircle && !o.isInstancedMesh) {
      const wp = o.getWorldPosition(new THREE.Vector3());
      addCircle(wp.x, wp.z, o.userData.solidCircle);
    }
  });
}
