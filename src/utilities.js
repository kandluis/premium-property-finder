import * as geometry from 'spherical-geometry-js';
import * as constants from 'constants';

/*
  Utility function to extract elements from an object.

  @param: object - the javascript object from which to extra an element.
  @param: path - the path to find.

  @returns: The extract object at the path, or null if the path is undefined.
*/
const get = (object, path) =>
  path.split('.').reduce((xs, x) => (xs != null && xs[x] != null) ? xs[x] : null, object)

/*
  Computes a bounding box around the (lat, lng) point with side lenghs of
  'side' miles.

  Works only for relatively small 'side' values (compared to earth radius)
  and when we're not too close to the poles.

  @param: lat - the latitude in degrees as a decimal.
  @param: lng - the longitude in degrees as a decimal.
  @param: side - the side length of the bounding box in miles.

  @returns: Object with four properties (north, east, soute, west) corresponding
    to the degree (either lat or long depending on direction) of the lines
    defining the bounding box.
*/
function boundingBox(lat, lng, side) {
  const sideLengthInMeters = side * 1.60934 * 1000;
  const center = new geometry.LatLng(lat, lng);
  return {
    'north': geometry.computeOffset(center, sideLengthInMeters, 0).latitude,
    'east': geometry.computeOffset(center, sideLengthInMeters, 90).longitude,
    'south': geometry.computeOffset(center, sideLengthInMeters, 180).latitude,
    'west': geometry.computeOffset(center, sideLengthInMeters, 270).longitude,
  }
}

/*
  Fetches database of rental estimates. 

  @returns: 
*/
async function dbFetch() {
  const url = `${constants.dbEndpoint}/get`
  const storageKey = `dbFetch(${url})`;
  const data = sessionStorage.getItem(storageKey);
  if (data != null) {
    return JSON.parse(data);
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': constants.DB_SECRET
    },
  });
  const result = await res.json();
  sessionStorage.setItem(storageKey, JSON.stringify(result));
  return result;
}

async function dbUpdate(db) {
  return await fetch(`${dbEndpoint}/set`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': constants.DB_SECRET
    },
    body: JSON.stringify(db),
  });
}

export {
  get,
  boundingBox,
  dbFetch,
  dbUpdate,
};  