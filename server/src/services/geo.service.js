import { env } from '../config/env.js';
import * as osmProvider from './providers/osm.provider.js';

// The Geo Abstraction (doc 05-06-07 §8): one interface, providers behind it.
// Switching GEO_PROVIDER=osm|google in env is meant to change zero business
// code — every caller in this codebase imports THIS file, never a provider
// module directly.
const providers = {
  osm: osmProvider,
  // google: not implemented — the documented future adapter for when the
  // free OSM stack needs to be swapped for a billed one (doc 05-06-07 §8).
};

function currentProvider() {
  const provider = providers[env.GEO_PROVIDER];

  if (!provider) {
    throw new Error(`GEO_PROVIDER "${env.GEO_PROVIDER}" has no adapter implementation`);
  }

  return provider;
}

export function geocode(text) {
  return currentProvider().geocode(text);
}

export function reverseGeocode(lat, lng) {
  return currentProvider().reverseGeocode(lat, lng);
}

export function route(from, to) {
  return currentProvider().route(from, to);
}
