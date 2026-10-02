import { geojson } from './dhaka.mjs';
const { features } = geojson();
const data = { type: 'FeatureCollection', features };
const W = (pairs) => ['interpolate', ['exponential', 1.6], ['zoom'], ...pairs.flat()];
export function style(theme = 'light') {
  const L = theme === 'light';
  const c = L
    ? { bg: '#F1EEE4', water: '#BFDDF0', park: '#D3E8CC', airport: '#E6E1D3', bld: '#E3DBC6', minor: '#FFFFFF', minorCase: '#DDD6C6', major: '#FFF1B8', majorCase: '#E8C766', rail: '#E11D48' }
    : { bg: '#0E1A16', water: '#0F2E3D', park: '#123324', airport: '#16231E', bld: '#1A2A24', minor: '#2A3B35', minorCase: '#1A2A24', major: '#5A4A1E', majorCase: '#3A3016', rail: '#FB7185' };
  const kind = (k) => ['==', ['get', 'kind'], k];
  return {
    version: 8, name: `cholo-${theme}`,
    sources: { dhaka: { type: 'geojson', data } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': c.bg } },
      { id: 'airport', type: 'fill', source: 'dhaka', filter: kind('airport'), paint: { 'fill-color': c.airport } },
      { id: 'park', type: 'fill', source: 'dhaka', filter: kind('park'), paint: { 'fill-color': c.park } },
      { id: 'water', type: 'fill', source: 'dhaka', filter: kind('water'), paint: { 'fill-color': c.water } },
      { id: 'bld', type: 'fill', source: 'dhaka', minzoom: 12.5, filter: kind('building'), paint: { 'fill-color': c.bld, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 14, 1] } },
      { id: 'minor-case', type: 'line', source: 'dhaka', filter: kind('minor'), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.minorCase, 'line-width': W([[11, 0.6], [14, 4], [17, 16]]) } },
      { id: 'minor', type: 'line', source: 'dhaka', filter: kind('minor'), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.minor, 'line-width': W([[11, 0.3], [14, 2.6], [17, 12]]) } },
      { id: 'rail', type: 'line', source: 'dhaka', filter: kind('rail'), paint: { 'line-color': c.rail, 'line-width': W([[11, 1.2], [14, 3], [17, 6]]), 'line-opacity': 0.55, 'line-dasharray': [2, 1] } },
      { id: 'major-case', type: 'line', source: 'dhaka', filter: kind('major'), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.majorCase, 'line-width': W([[10, 1.5], [14, 9], [17, 30]]) } },
      { id: 'major', type: 'line', source: 'dhaka', filter: kind('major'), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.major, 'line-width': W([[10, 1], [14, 6.5], [17, 24]]) } },
    ],
  };
}
