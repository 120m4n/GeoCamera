// Thin ESM façade over the official Google Open Location Code library.
// OpenLocationCode is a constructor — all methods live on the prototype.
import { OpenLocationCode } from './vendor/openlocationcode.js';

const olc = new OpenLocationCode();

export const encode   = (lat, lon, len = 10) => olc.encode(lat, lon, len);
export const isValid  = (code) => olc.isValid(code);
export const isFull   = (code) => olc.isFull(code);

export function decode(code) {
  try {
    const area = olc.decode(code);
    return {
      lat: area.latitudeCenter,
      lon: area.longitudeCenter,
      latLo: area.latitudeLo,
      lonLo: area.longitudeLo,
      latHi: area.latitudeHi,
      lonHi: area.longitudeHi,
    };
  } catch {
    return null;
  }
}

export function shorten(fullCode, refLat, refLon) {
  try { return olc.shorten(fullCode, refLat, refLon); }
  catch { return fullCode; }
}
