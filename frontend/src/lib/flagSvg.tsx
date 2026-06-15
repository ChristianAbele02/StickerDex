/**
 * SVG national-flag renderer for the 48 World Cup 2026 nations.
 *
 * Each flag is drawn on a 60×40 (3:2) canvas from a small set of primitives —
 * horizontal/vertical bands, Nordic & upright crosses, saltires, triangles,
 * discs, suns, crescents, stars and simplified emblems — so the album shows a
 * *recognizable national flag* (with its stars/crescents/crosses), not just a
 * colour gradient. Heraldic coats of arms are simplified to a legible emblem.
 *
 * Used as a background: render <FlagSvg/> filling a container with
 * `preserveAspectRatio="xMidYMid slice"`, then a dark scrim over it for text.
 */
import type { CSSProperties, ReactNode } from 'react';

const W = 60;
const H = 40;

/* ------------------------------ primitives ------------------------------ */

function R(x: number, y: number, w: number, h: number, fill: string, key?: string) {
  return <rect key={key} x={x} y={y} width={w} height={h} fill={fill} />;
}

/** Equal horizontal bands, top → bottom. */
function bandsH(colors: string[]): ReactNode[] {
  const h = H / colors.length;
  return colors.map((c, i) => R(0, i * h, W, h + 0.5, c, `h${i}`));
}

/** Equal vertical bands, hoist → fly. */
function bandsV(colors: string[]): ReactNode[] {
  const w = W / colors.length;
  return colors.map((c, i) => R(i * w, 0, w + 0.5, H, c, `v${i}`));
}

/** Weighted horizontal bands: [color, fraction] pairs (fractions sum to 1). */
function stackH(rows: [string, number][]): ReactNode[] {
  let y = 0;
  return rows.map(([c, f], i) => {
    const h = f * H;
    const el = R(0, y, W, h + 0.4, c, `sh${i}`);
    y += h;
    return el;
  });
}

/** Weighted vertical bands: [color, fraction] pairs. */
function stackV(cols: [string, number][]): ReactNode[] {
  let x = 0;
  return cols.map(([c, f], i) => {
    const w = f * W;
    const el = R(x, 0, w + 0.4, H, c, `sv${i}`);
    x += w;
    return el;
  });
}

function disc(cx: number, cy: number, r: number, fill: string, key?: string) {
  return <circle key={key} cx={cx} cy={cy} r={r} fill={fill} />;
}

/** Regular star polygon points. `rot` in degrees, 0 = a point upward. */
function starPts(cx: number, cy: number, outer: number, points = 5, rot = 0): string {
  const inner = outer * (points === 5 ? 0.382 : 0.5);
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i - Math.PI / 2 + (rot * Math.PI) / 180;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function star(cx: number, cy: number, outer: number, fill: string, points = 5, rot = 0, key?: string) {
  return <polygon key={key} points={starPts(cx, cy, outer, points, rot)} fill={fill} />;
}

/** A crescent (two-arc lune) centred at cx,cy, outer radius r, opening right. */
function crescentPath(cx: number, cy: number, r: number, k = 1.3): string {
  const top = `${cx},${cy - r}`;
  const bot = `${cx},${cy + r}`;
  const big = (r * k).toFixed(2);
  return `M ${top} A ${r} ${r} 0 0 0 ${bot} A ${big} ${big} 0 0 1 ${top} Z`;
}

function crescent(cx: number, cy: number, r: number, fill: string, rot = 0, key?: string) {
  return (
    <path key={key} d={crescentPath(cx, cy, r)} fill={fill} transform={`rotate(${rot} ${cx} ${cy})`} />
  );
}

/** A sun: a disc with radiating triangular rays (Argentina / Uruguay style). */
function sun(cx: number, cy: number, r: number, fill: string, rays = 16, key?: string): ReactNode {
  const spikes: string[] = [];
  for (let i = 0; i < rays; i++) {
    const a = (Math.PI * 2 * i) / rays;
    const a1 = a - 0.14;
    const a2 = a + 0.14;
    const ri = r * 1.05;
    const ro = r * 1.7;
    spikes.push(
      `${cx + ri * Math.cos(a1)},${cy + ri * Math.sin(a1)} ${cx + ro * Math.cos(a)},${
        cy + ro * Math.sin(a)
      } ${cx + ri * Math.cos(a2)},${cy + ri * Math.sin(a2)}`,
    );
  }
  return (
    <g key={key}>
      {spikes.map((p, i) => (
        <polygon key={i} points={p} fill={fill} />
      ))}
      <circle cx={cx} cy={cy} r={r} fill={fill} />
    </g>
  );
}

/** Nordic (offset) cross. */
function nordic(field: string, cross: string, border?: string): ReactNode[] {
  const cx = 22; // vertical bar centre (hoist-offset)
  const cy = H / 2;
  const t = 6; // bar thickness
  const out: ReactNode[] = [R(0, 0, W, H, field, 'nf')];
  if (border) {
    out.push(R(cx - t / 2 - 1.5, 0, t + 3, H, border, 'nbv'));
    out.push(R(0, cy - t / 2 - 1.5, W, t + 3, border, 'nbh'));
  }
  out.push(R(cx - t / 2, 0, t, H, cross, 'nvv'));
  out.push(R(0, cy - t / 2, W, t, cross, 'nvh'));
  return out;
}

/** Upright centred cross (Switzerland-style). */
function plusCross(field: string, cross: string, t = 8): ReactNode[] {
  return [
    R(0, 0, W, H, field, 'pf'),
    R(W / 2 - t / 2, H / 2 - 13, t, 26, cross, 'pv'),
    R(W / 2 - 13, H / 2 - t / 2, 26, t, cross, 'ph'),
  ];
}

/** Full St George cross (England-style). */
function stGeorge(field: string, cross: string, t = 7): ReactNode[] {
  return [
    R(0, 0, W, H, field, 'gf'),
    R(W / 2 - t / 2, 0, t, H, cross, 'gv'),
    R(0, H / 2 - t / 2, W, t, cross, 'gh'),
  ];
}

/** Saltire (X) cross, Scotland-style. */
function saltire(field: string, cross: string, t = 7): ReactNode[] {
  return [
    R(0, 0, W, H, field, 'sf'),
    <line key="sd1" x1={0} y1={0} x2={W} y2={H} stroke={cross} strokeWidth={t} />,
    <line key="sd2" x1={W} y1={0} x2={0} y2={H} stroke={cross} strokeWidth={t} />,
  ];
}

/** A simplified Union Jack inside a rect (for AUS / NZL cantons). */
function unionJack(x: number, y: number, w: number, h: number): ReactNode {
  const id = `uj${x}-${y}`;
  return (
    <g key="uj" clipPath={`url(#${id})`}>
      <defs>
        <clipPath id={id}>
          <rect x={x} y={y} width={w} height={h} />
        </clipPath>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill="#012169" />
      {/* white saltire */}
      <line x1={x} y1={y} x2={x + w} y2={y + h} stroke="#fff" strokeWidth={3} />
      <line x1={x + w} y1={y} x2={x} y2={y + h} stroke="#fff" strokeWidth={3} />
      {/* red saltire */}
      <line x1={x} y1={y} x2={x + w} y2={y + h} stroke="#C8102E" strokeWidth={1.3} />
      <line x1={x + w} y1={y} x2={x} y2={y + h} stroke="#C8102E" strokeWidth={1.3} />
      {/* white + red upright cross */}
      <rect x={x + w / 2 - 2.4} y={y} width={4.8} height={h} fill="#fff" />
      <rect x={x} y={y + h / 2 - 2.4} width={w} height={4.8} fill="#fff" />
      <rect x={x + w / 2 - 1.2} y={y} width={2.4} height={h} fill="#C8102E" />
      <rect x={x} y={y + h / 2 - 1.2} width={w} height={2.4} fill="#C8102E" />
    </g>
  );
}

/* ------------------------------- the 48 -------------------------------- */
/* Colours follow each flag; emblems are simplified for legibility at size. */

const FLAGS: Record<string, () => ReactNode[]> = {
  // ---- Group A ----
  MEX: () => [
    ...bandsV(['#006847', '#ffffff', '#ce1126']),
    disc(30, 20, 4.2, '#8c6239', 'e'),
    star(30, 20, 2.4, '#5c3d1e', 5, 0, 's'),
  ],
  RSA: () => [
    R(0, 0, W, 20, '#e03c31', 'r'),
    R(0, 20, W, 20, '#001489', 'b'),
    // white pall (fimbriation), then the green Y over it
    <polyline key="wp1" points="-3,-4 27,20 -3,44" fill="none" stroke="#ffffff" strokeWidth={18} />,
    <line key="wp2" x1={20} y1={20} x2={63} y2={20} stroke="#ffffff" strokeWidth={18} />,
    <polyline key="gp1" points="-3,-4 27,20 -3,44" fill="none" stroke="#007749" strokeWidth={9} />,
    <line key="gp2" x1={22} y1={20} x2={63} y2={20} stroke="#007749" strokeWidth={9} />,
    // gold-bordered black triangle at the hoist
    <polygon key="gold" points="-2,-2 21,20 -2,42" fill="#ffb81c" />,
    <polygon key="blk" points="-2,3 15,20 -2,37" fill="#000000" />,
  ],
  KOR: () => [
    R(0, 0, W, H, '#ffffff', 'f'),
    // taeguk
    <g key="tg" transform="translate(30 20)">
      <path d="M0,-7 A7,7 0 0,1 0,7 A3.5,3.5 0 0,1 0,0 A3.5,3.5 0 0,0 0,-7 Z" fill="#cd2e3a" />
      <path d="M0,7 A7,7 0 0,1 0,-7 A3.5,3.5 0 0,1 0,0 A3.5,3.5 0 0,0 0,7 Z" fill="#0047a0" />
    </g>,
    R(8, 11, 8, 1.2, '#000', 't1'),
    R(8, 13, 8, 1.2, '#000', 't2'),
    R(44, 27, 8, 1.2, '#000', 't3'),
    R(44, 29, 8, 1.2, '#000', 't4'),
  ],
  CZE: () => [
    R(0, 0, W, 20, '#ffffff', 't'),
    R(0, 20, W, 20, '#d7141a', 'b'),
    <polygon key="tri" points="0,0 26,20 0,40" fill="#11457e" />,
  ],

  // ---- Group B ----
  CAN: () => [
    ...stackV([['#d52b1e', 0.25], ['#ffffff', 0.5], ['#d52b1e', 0.25]]),
    // 11-point maple leaf (symmetric about x=30)
    <polygon
      key="leaf"
      points="30,8.5 31.1,12.8 34.6,12.2 33.4,15 37.8,15.6 34.9,18 35.9,19.2 32,19 33,23 30.8,22.2 30.9,30 29.1,30 29.2,22.2 27,23 28,19 24.1,19.2 25.1,18 22.2,15.6 26.6,15 25.4,12.2 28.9,12.8"
      fill="#d52b1e"
    />,
  ],
  BIH: () => [
    R(0, 0, W, H, '#002395', 'f'),
    <polygon key="tri" points="16,0 50,0 16,40" fill="#ffec00" />,
    ...Array.from({ length: 7 }, (_, i) =>
      star(40 - i * 5.3, 3 + i * 5.3, 2.1, '#ffffff', 5, 0, `bs${i}`),
    ),
  ],
  QAT: () => {
    // White at the hoist, maroon fly, separated by a 9-point serrated boundary.
    const n = 9;
    const x0 = 14;
    const x1 = 22;
    const edge: string[] = [];
    for (let i = 0; i <= n; i++) edge.push(`${i % 2 === 0 ? x1 : x0},${((i * H) / n).toFixed(1)}`);
    return [
      R(0, 0, W, H, '#ffffff', 'w'),
      <polygon key="m" points={`60,0 ${edge.join(' ')} 60,40`} fill="#8a1538" />,
    ];
  },
  SUI: () => plusCross('#d52b1e', '#ffffff'),

  // ---- Group C ----
  BRA: () => [
    R(0, 0, W, H, '#009b3a', 'f'),
    <polygon key="rh" points="30,4 55,20 30,36 5,20" fill="#ffdf00" />,
    disc(30, 20, 8.5, '#002776', 'c'),
    <path key="band" d="M22,18.5 A11,11 0 0,1 38,22.5 L38,21 A11,11 0 0,0 22,17 Z" fill="#fff" />,
    ...Array.from({ length: 9 }, (_, i) =>
      star(25 + (i % 5) * 2.4, 17 + Math.floor(i / 5) * 4, 0.8, '#fff', 5, 0, `bst${i}`),
    ),
  ],
  MAR: () => [
    R(0, 0, W, H, '#c1272d', 'f'),
    <polygon
      key="star"
      points={starPts(30, 20, 9, 5, 0)}
      fill="none"
      stroke="#006233"
      strokeWidth={1.6}
    />,
  ],
  HAI: () => [
    R(0, 0, W, 20, '#00209f', 't'),
    R(0, 20, W, 20, '#d21034', 'b'),
    R(24, 14, 12, 12, '#ffffff', 'p'),
    disc(30, 20, 2.4, '#006233', 'e'),
  ],
  SCO: () => saltire('#0065bf', '#ffffff', 7),

  // ---- Group D ----
  USA: () => [
    ...Array.from({ length: 13 }, (_, i) =>
      R(0, (i * H) / 13, W, H / 13 + 0.4, i % 2 === 0 ? '#b22234' : '#ffffff', `us${i}`),
    ),
    R(0, 0, 24, (7 * H) / 13, '#3c3b6e', 'canton'),
    ...Array.from({ length: 9 }, (_, row) =>
      Array.from({ length: row % 2 === 0 ? 6 : 5 }, (_, col) =>
        star(
          row % 2 === 0 ? 2.5 + col * 3.8 : 4.4 + col * 3.8,
          1.8 + row * 2.3,
          0.95,
          '#ffffff',
          5,
          0,
          `star${row}-${col}`,
        ),
      ),
    ).flat(),
  ],
  PAR: () => [
    ...bandsH(['#d52b1e', '#ffffff', '#0038a8']),
    disc(30, 20, 3.4, '#ffffff', 'e0'),
    star(30, 20, 2.2, '#0038a8', 5, 0, 'e1'),
  ],
  AUS: () => [
    R(0, 0, W, H, '#012169', 'f'),
    unionJack(0, 0, 26, 20),
    star(13, 30, 2.2, '#ffffff', 7, 0, 'cstar'),
    star(48, 9, 1.8, '#ffffff', 7, 0, 'sc1'),
    star(54, 18, 1.6, '#ffffff', 7, 0, 'sc2'),
    star(46, 24, 1.8, '#ffffff', 7, 0, 'sc3'),
    star(52, 31, 1.6, '#ffffff', 7, 0, 'sc4'),
    star(49, 21, 0.9, '#ffffff', 5, 0, 'sc5'),
  ],
  TUR: () => [
    R(0, 0, W, H, '#e30a17', 'f'),
    disc(25, 20, 8, '#ffffff', 'c1'),
    disc(28.5, 20, 6.4, '#e30a17', 'c2'),
    star(37, 20, 4, '#ffffff', 5, 18, 's'),
  ],

  // ---- Group E ----
  GER: () => bandsH(['#000000', '#dd0000', '#ffce00']),
  CUW: () => [
    R(0, 0, W, H, '#002b7f', 'f'),
    R(0, 26, W, 6, '#f9d616', 's'),
    star(13, 13, 3, '#ffffff', 5, 0, 's1'),
    star(20, 19, 2.2, '#ffffff', 5, 0, 's2'),
  ],
  CIV: () => bandsV(['#f77f00', '#ffffff', '#009e60']),
  ECU: () => [
    ...stackH([['#ffd100', 0.5], ['#0072ce', 0.25], ['#ef3340', 0.25]]),
    disc(30, 20, 4.5, '#ffd100', 'e0'),
    disc(30, 20, 3.2, '#3a7d3a', 'e1'),
  ],

  // ---- Group F ----
  NED: () => bandsH(['#ae1c28', '#ffffff', '#21468b']),
  JPN: () => [R(0, 0, W, H, '#ffffff', 'f'), disc(30, 20, 9, '#bc002d', 'c')],
  SWE: () => nordic('#006aa7', '#fecc00'),
  TUN: () => [
    R(0, 0, W, H, '#e70013', 'f'),
    disc(30, 20, 9, '#ffffff', 'c'),
    crescent(31, 20, 5.5, '#e70013', 0, 'cr'),
    star(33, 20, 2.4, '#e70013', 5, 18, 's'),
  ],

  // ---- Group G ----
  BEL: () => bandsV(['#000000', '#fdda24', '#ef3340']),
  EGY: () => [
    ...bandsH(['#ce1126', '#ffffff', '#000000']),
    disc(30, 20, 3.2, '#c09300', 'e'),
  ],
  IRN: () => [
    ...bandsH(['#239f40', '#ffffff', '#da0000']),
    <polygon key="em" points={starPts(30, 20, 3.2, 4, 0)} fill="#da0000" />,
  ],
  NZL: () => [
    R(0, 0, W, H, '#012169', 'f'),
    unionJack(0, 0, 26, 20),
    star(48, 11, 2, '#C8102E', 5, 0, 'n1'),
    star(53, 20, 1.8, '#C8102E', 5, 0, 'n2'),
    star(45, 25, 2, '#C8102E', 5, 0, 'n3'),
    star(50, 31, 1.8, '#C8102E', 5, 0, 'n4'),
  ],

  // ---- Group H ----
  ESP: () => [
    ...stackH([['#aa151b', 0.25], ['#f1bf00', 0.5], ['#aa151b', 0.25]]),
    // Simplified coat of arms near the hoist.
    <rect key="shb" x={11} y={14.5} width={7.5} height={11} fill="#c8102e" rx={1.2} />,
    <rect key="shc" x={12.4} y={16.2} width={4.7} height={7.6} fill="#f1bf00" rx={0.6} />,
    <rect key="crown" x={12.6} y={12.6} width={4.3} height={2.4} fill="#c79a00" rx={0.5} />,
  ],
  CPV: () => [
    R(0, 0, W, H, '#003893', 'f'),
    R(0, 22, W, 4, '#ffffff', 'w1'),
    R(0, 26, W, 4, '#cf2027', 'r'),
    R(0, 30, W, 4, '#ffffff', 'w2'),
    ...Array.from({ length: 10 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
      return star(22 + 9 * Math.cos(a), 22 + 9 * Math.sin(a), 1.3, '#f7d116', 5, 0, `cs${i}`);
    }),
  ],
  KSA: () => [
    R(0, 0, W, H, '#006c35', 'f'),
    R(12, 17, 36, 1.6, '#ffffff', 'shahada'),
    R(12, 24, 28, 2, '#ffffff', 'sword'),
    <polygon key="tip" points="12,25 8,25 12,23" fill="#ffffff" />,
  ],
  URU: () => [
    ...Array.from({ length: 9 }, (_, i) =>
      R(0, (i * H) / 9, W, H / 9 + 0.3, i % 2 === 0 ? '#ffffff' : '#0038a8', `us${i}`),
    ),
    R(0, 0, 24, (4 * H) / 9, '#ffffff', 'canton'),
    sun(12, 9, 3, '#fcd116', 16, 'sun'),
  ],

  // ---- Group I ----
  FRA: () => bandsV(['#0055a4', '#ffffff', '#ef4135']),
  SEN: () => [...bandsV(['#00853f', '#fdef42', '#e31b23']), star(30, 20, 4.5, '#00853f', 5, 0, 's')],
  IRQ: () => [
    ...bandsH(['#ce1126', '#ffffff', '#000000']),
    R(22, 18.5, 4, 3, '#007a3d', 't1'),
    R(28, 18.5, 4, 3, '#007a3d', 't2'),
    R(34, 18.5, 4, 3, '#007a3d', 't3'),
  ],
  NOR: () => nordic('#ba0c2f', '#00205b', '#ffffff'),

  // ---- Group J ----
  ARG: () => [
    ...bandsH(['#75aadb', '#ffffff', '#75aadb']),
    sun(30, 20, 3, '#f6b40e', 16, 'sun'),
  ],
  ALG: () => [
    R(0, 0, W, H, '#ffffff', 'w'),
    R(0, 0, 30, H, '#006233', 'g'),
    crescent(31, 20, 6, '#d21034', -20, 'cr'),
    star(36, 20, 3, '#d21034', 5, 18, 's'),
  ],
  AUT: () => bandsH(['#ed2939', '#ffffff', '#ed2939']),
  JOR: () => [
    ...bandsH(['#000000', '#ffffff', '#007a3d']),
    <polygon key="tri" points="0,0 26,20 0,40" fill="#ce1126" />,
    star(8.5, 20, 2.4, '#ffffff', 7, 0, 's'),
  ],

  // ---- Group K ----
  POR: () => [
    ...stackV([['#006600', 0.4], ['#da291c', 0.6]]),
    disc(24, 20, 5, '#ffe000', 'arm0'),
    disc(24, 20, 3.4, '#ffffff', 'arm1'),
    R(22.4, 16.6, 3.2, 6.8, '#da291c', 'arm2'),
  ],
  COD: () => [
    R(0, 0, W, H, '#007fff', 'f'),
    <line key="db" x1={0} y1={H} x2={W} y2={0} stroke="#f7d618" strokeWidth={11} />,
    <line key="dr" x1={0} y1={H} x2={W} y2={0} stroke="#ce1021" strokeWidth={6} />,
    star(9, 8, 3.4, '#f7d618', 5, 0, 's'),
  ],
  UZB: () => [
    ...bandsH(['#1eb53a', '#ffffff', '#0099b5']),
    R(0, 13, W, 0.8, '#ce1126', 'r1'),
    R(0, 26.2, W, 0.8, '#ce1126', 'r2'),
    crescent(10, 6.7, 3.4, '#ffffff', 0, 'cr'),
    star(15, 5, 1, '#ffffff', 5, 0, 'm1'),
    star(18.5, 5, 1, '#ffffff', 5, 0, 'm2'),
    star(15, 8.4, 1, '#ffffff', 5, 0, 'm3'),
  ],
  COL: () => stackH([['#fcd116', 0.5], ['#003893', 0.25], ['#ce1126', 0.25]]),

  // ---- Group L ----
  ENG: () => stGeorge('#ffffff', '#ce1124'),
  CRO: () => [
    ...bandsH(['#ff0000', '#ffffff', '#171796']),
    R(23, 13, 14, 14, '#ffffff', 'shield'),
    ...Array.from({ length: 16 }, (_, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      return (col + row) % 2 === 0
        ? R(23 + col * 3.5, 13 + row * 3.5, 3.5, 3.5, '#d11', `chk${i}`)
        : null;
    }),
  ],
  GHA: () => [...bandsH(['#ce1126', '#fcd116', '#006b3f']), star(30, 20, 3.4, '#000000', 5, 0, 's')],
  PAN: () => [
    R(0, 0, W, H, '#ffffff', 'f'),
    R(30, 0, 30, 20, '#d21034', 'q2'),
    R(0, 20, 30, 20, '#005293', 'q3'),
    star(15, 10, 4, '#005293', 5, 0, 's1'),
    star(45, 30, 4, '#d21034', 5, 0, 's2'),
  ],
};

export function hasFlagSvg(code: string): boolean {
  return code in FLAGS;
}

export interface FlagSvgProps {
  code: string;
  className?: string;
  style?: CSSProperties;
  /** Background layer mode: stretch to cover its container. */
  cover?: boolean;
}

/**
 * Render a nation's flag as an inline SVG. As a background, pass `cover` so it
 * fills the container (object-fit-like) behind a scrim.
 */
export function FlagSvg({ code, className, style, cover }: FlagSvgProps) {
  const draw = FLAGS[code];
  const children = draw ? draw() : [R(0, 0, W, H, '#334155', 'f0'), R(0, H / 2, W, H / 2, '#1e293b', 'f1')];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={style}
      preserveAspectRatio={cover ? 'xMidYMid slice' : 'xMidYMid meet'}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
