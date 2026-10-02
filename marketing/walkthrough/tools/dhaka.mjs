export const ARTERIALS = {
  'Airport Road': [[90.401,23.88],[90.406,23.86],[90.4085,23.845],[90.407,23.828],[90.404,23.81],[90.402,23.795],[90.4005,23.782],[90.396,23.77],[90.391,23.762],[90.39,23.758],[90.3925,23.7515],[90.395,23.744],[90.3958,23.7385],[90.403,23.733],[90.412,23.73],[90.418,23.729]],
  'Pragati Sarani': [[90.421,23.825],[90.423,23.8],[90.426,23.781],[90.423,23.765],[90.419,23.755],[90.415,23.747],[90.417,23.736],[90.418,23.729]],
  'Begum Rokeya Sarani': [[90.366,23.825],[90.3685,23.807],[90.372,23.799],[90.376,23.7905],[90.38,23.778],[90.388,23.766],[90.39,23.758]],
  'Mirpur Road': [[90.353,23.798],[90.358,23.785],[90.365,23.774],[90.37,23.765],[90.373,23.76],[90.375,23.756],[90.379,23.746],[90.383,23.739],[90.386,23.733],[90.396,23.725],[90.407,23.712]],
  'Gulshan Avenue': [[90.4167,23.778],[90.4155,23.786],[90.4148,23.7925],[90.417,23.8],[90.423,23.805]],
  'Kemal Ataturk Avenue': [[90.402,23.795],[90.41,23.794],[90.4148,23.7925]],
  'Bir Uttam Mir Shawkat Sarak': [[90.4005,23.78],[90.408,23.779],[90.4167,23.778],[90.426,23.781]],
  'Hatirjheel Link': [[90.399,23.764],[90.407,23.76],[90.419,23.755]],
  'Bashundhara Road': [[90.423,23.815],[90.44,23.818],[90.4526,23.8193]],
  'Elephant Road': [[90.383,23.739],[90.3958,23.7385]],
  'Ring Road': [[90.358,23.765],[90.37,23.765],[90.373,23.76]],
  'Kamalapur Road': [[90.418,23.729],[90.426,23.732]],
  'Moghbazar Flyover': [[90.3925,23.7515],[90.405,23.748],[90.415,23.747]],
  'Mirpur Link': [[90.3654,23.8193],[90.385,23.82],[90.407,23.828]],
  'Kazi Nazrul Avenue': [[90.3958,23.7385],[90.3987,23.7334],[90.4076,23.7299],[90.418,23.729]],
};
export const MRT6 = [
  ['Uttara North',23.8692,90.3673],['Uttara Center',23.8597,90.3655],['Uttara South',23.8457,90.3633],['Pallabi',23.8263,90.3644],
  ['Mirpur 11',23.8193,90.3654],['Mirpur 10',23.807,90.3685],['Kazipara',23.7993,90.372],['Shewrapara',23.7905,90.3758],
  ['Agargaon',23.7781,90.38],['Bijoy Sarani',23.766,90.3882],['Farmgate',23.7577,90.3897],['Karwan Bazar',23.7509,90.393],
  ['Shahbagh',23.7389,90.3958],['Dhaka University',23.7334,90.3987],['Secretariat',23.7299,90.4076],['Motijheel',23.7276,90.4178],
];
export const PLACES = {
  'Uttara':[23.874,90.398],'Airport':[23.8433,90.3978],'Banani':[23.7937,90.4066],'Gulshan 1':[23.7806,90.4167],'Gulshan 2':[23.7925,90.4148],
  'Baridhara':[23.8,90.423],'Bashundhara':[23.8193,90.4526],'Badda':[23.7805,90.4267],'Rampura':[23.7612,90.421],'Mohakhali':[23.778,90.4005],
  'Tejgaon':[23.763,90.399],'Farmgate':[23.758,90.39],'Karwan Bazar':[23.751,90.393],'Dhanmondi':[23.748,90.376],'Mohammadpur':[23.765,90.358],
  'Shyamoli':[23.774,90.365],'Mirpur 10':[23.807,90.368],'Mirpur 1':[23.798,90.353],'Agargaon':[23.778,90.38],'Shahbagh':[23.738,90.396],
  'Motijheel':[23.733,90.418],'Kamalapur':[23.732,90.426],'Old Dhaka':[23.712,90.407],'Pallabi':[23.826,90.364],
};
const ring = (pts) => [...pts, pts[0]];
export const WATER = [
  ring([[90.33,23.712],[90.36,23.704],[90.39,23.7],[90.42,23.699],[90.45,23.703],[90.47,23.708],[90.47,23.696],[90.45,23.69],[90.42,23.687],[90.39,23.688],[90.36,23.692],[90.33,23.699]]),
  ring([[90.338,23.72],[90.343,23.76],[90.34,23.8],[90.345,23.84],[90.353,23.88],[90.346,23.88],[90.337,23.84],[90.332,23.8],[90.335,23.76],[90.331,23.72]]),
  ring([[90.401,23.762],[90.405,23.7665],[90.41,23.766],[90.414,23.7615],[90.4185,23.7585],[90.4175,23.756],[90.412,23.7585],[90.407,23.7615],[90.403,23.7595]]),
  ring([[90.4125,23.79],[90.4135,23.796],[90.4185,23.802],[90.4225,23.801],[90.418,23.795],[90.416,23.789]]),
  ring([[90.373,23.752],[90.376,23.754],[90.378,23.748],[90.38,23.742],[90.378,23.741],[90.375,23.747]]),
  ring([[90.4,23.7995],[90.404,23.801],[90.407,23.799],[90.405,23.797],[90.401,23.798]]),
];
export const PARKS = [
  ring([[90.397,23.737],[90.404,23.738],[90.405,23.734],[90.398,23.733]]),
  ring([[90.346,23.815],[90.358,23.818],[90.36,23.81],[90.348,23.807]]),
  ring([[90.377,23.774],[90.384,23.776],[90.386,23.771],[90.379,23.769]]),
  ring([[90.36,23.75],[90.365,23.751],[90.366,23.747],[90.361,23.746]]),
];
export const AIRPORT = [ring([[90.388,23.858],[90.403,23.858],[90.404,23.828],[90.389,23.828]])];
const HOODS = [
  ['Uttara',90.386,90.404,23.862,23.885,0.0038,4],['Banani',90.4,90.412,23.786,23.8,0.003,-8],['Gulshan',90.408,90.428,23.774,23.81,0.0034,-6],
  ['Dhanmondi',90.367,90.388,23.738,23.762,0.0032,8],['Mohammadpur',90.35,90.367,23.752,23.772,0.0035,10],['Mirpur',90.352,90.376,23.79,23.83,0.0036,3],
  ['Tejgaon',90.388,90.402,23.762,23.79,0.0036,0],['Badda',90.42,90.44,23.765,23.8,0.0038,-4],['Bashundhara',90.425,90.456,23.81,23.83,0.0034,0],
  ['Motijheel',90.405,90.43,23.72,23.745,0.003,5],['Old Dhaka',90.385,90.425,23.705,23.722,0.0028,12],['Shahbagh',90.383,90.405,23.725,23.752,0.0034,6],
  ['Rampura',90.408,90.43,23.745,23.765,0.0034,-3],['Agargaon',90.37,90.392,23.765,23.79,0.004,4],['Khilkhet',90.41,90.44,23.82,23.86,0.004,0],
];
function inside(pt, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j];
  if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; }
const wet = (p) => WATER.some((w) => inside(p, w)) || AIRPORT.some((a) => inside(p, a));
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
export function localGrids() {
  const grids = [];
  for (const [name, x0, x1, y0, y1, step, rotDeg] of HOODS) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, a = rotDeg * Math.PI / 180;
    const rot = ([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)];
    const nx = Math.round((x1 - x0) / step), ny = Math.round((y1 - y0) / step);
    const nodes = [];
    for (let i = 0; i <= nx; i++) { nodes[i] = []; for (let j = 0; j <= ny; j++) {
      const p = rot([x0 + i * step + (rnd() - .5) * step * .25, y0 + j * step + (rnd() - .5) * step * .25]);
      nodes[i][j] = wet(p) ? null : p; } }
    grids.push({ name, nodes, nx, ny });
  }
  return grids;
}
export function buildings(grids) {
  const out = [];
  for (const g of grids) for (let i = 0; i < g.nx; i++) for (let j = 0; j < g.ny; j++) {
    const a = g.nodes[i][j], b = g.nodes[i + 1][j], c = g.nodes[i + 1][j + 1], d = g.nodes[i][j + 1];
    if (!a || !b || !c || !d) continue;
    const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    for (let k = 0; k < 4; k++) {
      const u0 = .12 + (k % 2) * .44, v0 = .12 + Math.floor(k / 2) * .44, du = .32 + rnd() * .06, dv = .32 + rnd() * .06;
      if (rnd() < .18) continue;
      const P = (u, v) => lerp(lerp(a, b, u), lerp(d, c, u), v);
      out.push(ring([P(u0, v0), P(u0 + du, v0), P(u0 + du, v0 + dv), P(u0, v0 + dv)]));
    }
  }
  return out;
}
export function geojson() {
  const grids = localGrids();
  const F = (geom, props = {}) => ({ type: 'Feature', properties: props, geometry: geom });
  const feats = [];
  WATER.forEach((w) => feats.push(F({ type: 'Polygon', coordinates: [w] }, { kind: 'water' })));
  PARKS.forEach((w) => feats.push(F({ type: 'Polygon', coordinates: [w] }, { kind: 'park' })));
  AIRPORT.forEach((w) => feats.push(F({ type: 'Polygon', coordinates: [w] }, { kind: 'airport' })));
  buildings(grids).forEach((b) => feats.push(F({ type: 'Polygon', coordinates: [b] }, { kind: 'building' })));
  for (const g of grids) {
    for (let i = 0; i <= g.nx; i++) { let run = []; for (let j = 0; j <= g.ny + 1; j++) { const p = j <= g.ny ? g.nodes[i][j] : null;
      if (p) run.push(p); else { if (run.length > 1) feats.push(F({ type: 'LineString', coordinates: run }, { kind: 'minor' })); run = []; } } }
    for (let j = 0; j <= g.ny; j++) { let run = []; for (let i = 0; i <= g.nx + 1; i++) { const p = i <= g.nx ? g.nodes[i][j] : null;
      if (p) run.push(p); else { if (run.length > 1) feats.push(F({ type: 'LineString', coordinates: run }, { kind: 'minor' })); run = []; } } }
  }
  for (const [name, coords] of Object.entries(ARTERIALS)) feats.push(F({ type: 'LineString', coordinates: coords }, { kind: 'major', name }));
  feats.push(F({ type: 'LineString', coordinates: MRT6.map(([, la, ln]) => [ln, la]) }, { kind: 'rail' }));
  return { type: 'FeatureCollection', features: feats, grids };
}
