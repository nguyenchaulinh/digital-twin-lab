// Plain 2D geometry on [east, north] points in metres. No three.js here, so it can be unit tested in Node.
export type Ring = number[][];

export function polygonArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

// Mean of the vertices: good enough to place a camera or split a footprint
export function ringCentroid(ring: Ring): [number, number] {
  const n = ring.length;
  return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
}

// Angle of the long axis, from the covariance of the vertices
export function principalAngle(ring: Ring): number {
  const [cx, cy] = ringCentroid(ring);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of ring) {
    sxx += (x - cx) ** 2;
    syy += (y - cy) ** 2;
    sxy += (x - cx) * (y - cy);
  }
  return 0.5 * Math.atan2(2 * sxy, sxx - syy);
}

// Sutherland–Hodgman against one half-plane: keep the part where nx*x + ny*y <= d
export function clipHalfPlane(ring: Ring, nx: number, ny: number, d: number): Ring {
  const side = (p: number[]) => nx * p[0] + ny * p[1] - d;
  const out: Ring = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const sa = side(a);
    const sb = side(b);
    if (sa <= 0) out.push(a);
    if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) {
      const t = sa / (sa - sb);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

// Cut a footprint in two across its long axis: [low half, high half]
export function splitAlongLongAxis(ring: Ring): [Ring, Ring] {
  const angle = principalAngle(ring);
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const [cx, cy] = ringCentroid(ring);
  const d = ux * cx + uy * cy;
  return [clipHalfPlane(ring, ux, uy, d), clipHalfPlane(ring, -ux, -uy, -d)];
}

// Triangles (x, y pairs, 6 vertices per segment) for a polyline drawn as a ribbon of the given width
export function ribbonTriangles(points: Ring, width: number): number[] {
  const out: number[] = [];
  const half = width / 2;
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const length = Math.hypot(bx - ax, by - ay);
    if (length === 0) continue;
    const nx = (-(by - ay) / length) * half;
    const ny = ((bx - ax) / length) * half;
    out.push(ax + nx, ay + ny, ax - nx, ay - ny, bx - nx, by - ny, ax + nx, ay + ny, bx - nx, by - ny, bx + nx, by + ny);
  }
  return out;
}
