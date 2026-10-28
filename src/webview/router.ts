/**
 * Orthogonal line router. A route is a list of "channels": x of a vertical run, then y of a
 * horizontal run, then x, ... (odd length). `[x]` is the plain H-V-H route.
 */
export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Port extends Pt { dir: 1 | -1 }

export interface Req {
  id: string;
  a: Port;
  b: Port;
  /** Index into the obstacle list of the tables at either end (their own stubs may touch them). */
  srcObs: number;
  dstObs: number;
  /** A hand-edited route: kept as is, and other lines route around it. */
  manual?: number[];
}

/** Space kept between a line and a table: wide on the sides so the first turn clears the column text. */
const CLEAR_X = 24;
const CLEAR_Y = 8;
const MIN_STUB = 22;
const BEND = 24;
const LANE = 10;
const OVERLAP = 3;
/** Flat cost for sharing any stretch of another line, so even a short overlap is worth a detour. */
const OVERLAP_FIXED = 80;
const CROSS = 40;

export function routePoints(a: Pt, b: Pt, channels: number[]): Pt[] {
  const pts: Pt[] = [a];
  let x = a.x, y = a.y;
  channels.forEach((c, i) => {
    if (i % 2 === 0) {
      x = c;
    } else {
      y = c;
    }
    pts.push({ x, y });
  });
  pts.push({ x, y: b.y }, b);
  return pts;
}

/** `port` is set on the two end runs: lines that share a port may share that run. */
interface Seg { h: boolean; c: number; lo: number; hi: number; port?: string }

function segments(pts: Pt[]): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    if (p.x === q.x && p.y === q.y) {
      continue;
    }
    const h = p.y === q.y;
    out.push({
      h,
      c: h ? p.y : p.x,
      lo: h ? Math.min(p.x, q.x) : Math.min(p.y, q.y),
      hi: h ? Math.max(p.x, q.x) : Math.max(p.y, q.y),
      port: i === 0 ? `${pts[0].x},${pts[0].y}` : i === pts.length - 2 ? `${pts[i + 1].x},${pts[i + 1].y}` : undefined
    });
  }
  return out;
}

/** Candidate coordinates: every obstacle edge, plus lanes through the gaps between edges and beyond the outermost ones. */
function axisCandidates(edges: number[], lows: number[], highs: number[]): number[] {
  const e = [...new Set(edges)].sort((p, q) => p - q);
  const out = new Set<number>(e);
  for (let i = 0; i < e.length - 1; i++) {
    const g = e[i + 1] - e[i];
    if (g < 12) {
      continue;
    }
    const mid = (e[i] + e[i + 1]) / 2;
    out.add(mid);
    for (let k = 1; k <= 6 && k * LANE < g / 2 - 4; k++) {
      out.add(mid - k * LANE);
      out.add(mid + k * LANE);
    }
  }
  // Lanes hugging each obstacle, so parallel lines can sit side by side right next to a table.
  for (let k = 1; k <= 5; k++) {
    lows.forEach(v => out.add(v - k * LANE));
    highs.forEach(v => out.add(v + k * LANE));
  }
  for (let k = 1; k <= 4; k++) {
    out.add(e[0] - k * 18);
    out.add(e[e.length - 1] + k * 18);
  }
  return [...out].sort((p, q) => p - q);
}

/**
 * Route every line. `passes` is how many times conflicting lines are ripped up and re-routed
 * afterwards: use 0 while dragging for speed, and the default when the layout settles.
 */
export function routeAll(reqs: Req[], obstacles: Rect[], passes = 3): Map<string, number[]> {
  const obs = obstacles.map(o => ({ x0: o.x - CLEAR_X, x1: o.x + o.w + CLEAR_X, y0: o.y - CLEAR_Y, y1: o.y + o.h + CLEAR_Y }));
  const xs = axisCandidates(obs.flatMap(o => [o.x0, o.x1]), obs.map(o => o.x0), obs.map(o => o.x1));
  const ys = axisCandidates(obs.flatMap(o => [o.y0, o.y1]), obs.map(o => o.y0), obs.map(o => o.y1));
  const result = new Map<string, number[]>();
  /** Segments of every routed line, so a line can be scored against all the others. */
  const taken = new Map<string, Seg[]>();

  const blocked = (h: boolean, c: number, lo: number, hi: number, skip: number) => {
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      if (i === skip) {
        continue;
      }
      if (h ? c > o.y0 && c < o.y1 && hi > o.x0 && lo < o.x1 : c > o.x0 && c < o.x1 && hi > o.y0 && lo < o.y1) {
        return true;
      }
    }
    return false;
  };

  const penalty = (segs: Seg[], owner: string) => {
    let p = 0;
    for (const s of segs) {
      for (const [id, others] of taken) {
        if (id === owner) {
          continue;
        }
        for (const t of others) {
          if (s.h === t.h) {
            const overlap = Math.min(s.hi, t.hi) - Math.max(s.lo, t.lo);
            const shared = s.port !== undefined && s.port === t.port;
            // Segments that merely meet end to end on the same line also read as one line.
            if (Math.abs(s.c - t.c) < 4 && overlap > -6 && !shared) {
              p += OVERLAP_FIXED + OVERLAP * Math.max(0, overlap);
            }
          } else if (t.c > s.lo && t.c < s.hi && s.c > t.lo && s.c < t.hi) {
            p += CROSS;
          }
        }
      }
    }
    return p;
  };

  const pick = (r: Req, cands: { ch: number[]; cost: number }[], valid: (ch: number[]) => boolean) => {
    cands.sort((p, q) => p.cost - q.cost);
    let best: { ch: number[]; cost: number } | null = null, found = 0;
    for (let i = 0; i < cands.length && i < 400; i++) {
      const c = cands[i];
      if (best && c.cost >= best.cost) {
        break;
      }
      if (!valid(c.ch)) {
        continue;
      }
      const total = c.cost + penalty(segments(routePoints(r.a, r.b, c.ch)), r.id);
      if (!best || total < best.cost) {
        best = { ch: c.ch, cost: total };
      }
      if (++found >= 6) {
        break;
      }
    }
    return best?.ch;
  };

  const manual = reqs.filter(r => r.manual);
  const auto = reqs.filter(r => !r.manual).sort(
    (p, q) => Math.abs(p.a.x - p.b.x) + Math.abs(p.a.y - p.b.y) - Math.abs(q.a.x - q.b.x) - Math.abs(q.a.y - q.b.y)
  );

  for (const r of manual) {
    result.set(r.id, r.manual!);
    taken.set(r.id, segments(routePoints(r.a, r.b, r.manual!)));
  }

  const place = (r: Req) => {
    const { a, b } = r;
    const okA = (x: number) => a.dir * (x - a.x) >= MIN_STUB;
    const okB = (x: number) => b.dir * (x - b.x) >= MIN_STUB;

    const three = xs.filter(x => okA(x) && okB(x)).map(x => ({
      ch: [x],
      cost: Math.abs(x - a.x) + Math.abs(b.y - a.y) + Math.abs(x - b.x) + 2 * BEND
    }));
    let ch = pick(r, three, ([x]) =>
      !blocked(true, a.y, Math.min(a.x, x), Math.max(a.x, x), r.srcObs) &&
      !blocked(false, x, Math.min(a.y, b.y), Math.max(a.y, b.y), -1) &&
      !blocked(true, b.y, Math.min(b.x, x), Math.max(b.x, x), r.dstObs)
    );

    if (!ch) {
      const near = (okFn: (x: number) => boolean, at: number) =>
        xs.filter(okFn).sort((p, q) => Math.abs(p - at) - Math.abs(q - at)).slice(0, 6);
      const five: { ch: number[]; cost: number }[] = [];
      for (const x1 of near(okA, a.x)) {
        for (const x2 of near(okB, b.x)) {
          for (const y of ys) {
            five.push({
              ch: [x1, y, x2],
              cost: Math.abs(x1 - a.x) + Math.abs(y - a.y) + Math.abs(x2 - x1) + Math.abs(b.y - y) + Math.abs(b.x - x2) + 4 * BEND
            });
          }
        }
      }
      ch = pick(r, five, ([x1, y, x2]) =>
        !blocked(true, a.y, Math.min(a.x, x1), Math.max(a.x, x1), r.srcObs) &&
        !blocked(false, x1, Math.min(a.y, y), Math.max(a.y, y), -1) &&
        !blocked(true, y, Math.min(x1, x2), Math.max(x1, x2), -1) &&
        !blocked(false, x2, Math.min(y, b.y), Math.max(y, b.y), -1) &&
        !blocked(true, b.y, Math.min(b.x, x2), Math.max(b.x, x2), r.dstObs)
      );
    }

    ch ??= [a.dir === b.dir ? (a.dir > 0 ? Math.max(a.x, b.x) + 27 : Math.min(a.x, b.x) - 27) : (a.x + b.x) / 2];
    result.set(r.id, ch);
    taken.set(r.id, segments(routePoints(a, b, ch)));
  };

  // Short lines first; they claim the lanes closest to the tables.
  auto.forEach(place);
  // Greedy order can leave lines crossing or stacked. Rip up every line that still conflicts with another and route it again.
  for (let pass = 0; pass < passes; pass++) {
    let changed = false;
    for (const r of auto) {
      if (penalty(taken.get(r.id)!, r.id) > 0) {
        const before = result.get(r.id)!.join();
        taken.delete(r.id);
        place(r);
        changed ||= result.get(r.id)!.join() !== before;
      }
    }
    if (!changed) {
      break;
    }
  }
  return result;
}
