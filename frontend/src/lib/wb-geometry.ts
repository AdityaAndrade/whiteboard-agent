export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }

/** Closest point on a rect's border toward an external target point. */
export function rectAnchor(r: Rect, tx: number, ty: number): Point {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2
  const dx = tx - cx, dy = ty - cy
  if (!dx && !dy) return { x: cx, y: cy }
  const sx = dx ? (r.w / 2) / Math.abs(dx) : Infinity
  const sy = dy ? (r.h / 2) / Math.abs(dy) : Infinity
  const s = Math.min(sx, sy)
  return { x: cx + dx * s, y: cy + dy * s }
}

export interface Curve { d: string; mid: Point }

/** Cubic bezier between two points, biased horizontal or vertical based on the larger delta. */
export function curve(pA: Point, pB: Point): Curve {
  const dx = pB.x - pA.x, dy = pB.y - pA.y
  const horiz = Math.abs(dx) >= Math.abs(dy)
  const k = Math.max(36, (horiz ? Math.abs(dx) : Math.abs(dy)) * 0.5)
  let c1: Point, c2: Point
  if (horiz) {
    c1 = { x: pA.x + Math.sign(dx || 1) * k, y: pA.y }
    c2 = { x: pB.x - Math.sign(dx || 1) * k, y: pB.y }
  } else {
    c1 = { x: pA.x, y: pA.y + Math.sign(dy || 1) * k }
    c2 = { x: pB.x, y: pB.y - Math.sign(dy || 1) * k }
  }
  const d = `M${pA.x},${pA.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${pB.x},${pB.y}`
  const mid: Point = {
    x: 0.125 * pA.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * pB.x,
    y: 0.125 * pA.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * pB.y,
  }
  return { d, mid }
}

/** Bezier path connecting the nearest borders of two node rects. */
export function edgePath(a: Rect, b: Rect): Curve {
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 }
  const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  const pA = rectAnchor(a, cb.x, cb.y)
  const pB = rectAnchor(b, ca.x, ca.y)
  return curve(pA, pB)
}

export const NODE_W = 218
export const DEF_H = 96
