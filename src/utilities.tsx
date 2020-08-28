import { computeOffset, LatLng } from 'spherical-geometry-js';
import { parseStringPromise } from 'xml2js';
import { dbEndpoint, DB_SECRET, proxyUrl } from './constants';

/**
  Utility function to extract elements from an object.

  @param object - The javascript object from which to extra an element
  @param path - The path to find

  @returns The extract object at the path, or null if the path is undefined
*/
function get(object: unknown, path: string): unknown | null {
  return path.split('.').reduce((xs, x) => ((xs != null && xs[x] != null) ? xs[x] : null), object);
}

/**
  Fetches the JSON reponse at the specified URL.

  @remarks
  Results are cached in the session storage to avoid unnecessary
  load on APIs.

  @param url - The url to fetch. This url is used as a key for caching
  @param format - The format of the response expected from the url
  @param useProxy - If set to true, a proxy is used to avoid CORS restrictions

  @returns: The response, in JSON format from the url.
*/
async function getJsonResponse(url: string, format = 'json', useProxy = false) : Promise<any> {
  let fullUrl = url;
  if (useProxy) {
    fullUrl = `${proxyUrl}/${url}`;
  }
  const storageKey = `getJsonReponse(${fullUrl})`;
  const data = sessionStorage.getItem(storageKey);
  if (data != null) {
    return JSON.parse(data);
  }
  const blob = await fetch(fullUrl, {
    headers: {
      'Api-Key': DB_SECRET,
    },
  });
  let parsedData = null;
  if (format === 'json') {
    parsedData = await blob.json();
  } else if (format === 'xml') {
    const parsedText = await blob.text();
    parsedData = await parseStringPromise(parsedText);
    parsedData = get(parsedData,
      'SearchResults:searchresults.response.0.results.0.result');
  }
  sessionStorage.setItem(storageKey, JSON.stringify(parsedData));
  return parsedData;
}

interface LocationBox {
  north: number,
  east: number,
  south: number,
  west: number,
}
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
function boundingBox(lat: number, lng: number, side: number): LocationBox {
  const sideLengthInMeters = side * 1.60934 * 1000;
  const center = new LatLng(lat, lng);
  return {
    north: computeOffset(center, sideLengthInMeters, 0).latitude,
    east: computeOffset(center, sideLengthInMeters, 90).longitude,
    south: computeOffset(center, sideLengthInMeters, 180).latitude,
    west: computeOffset(center, sideLengthInMeters, 270).longitude,
  };
}

interface Database {
  [zpid: number]: {
    rentzestimate: number,
    zestimate: number,
  },
}
/**
  Fetches database of rental estimates.

  @returns: A Database object contaiing known zpid and relevant information.
*/
async function dbFetch(): Promise<Database> {
  const url = `${dbEndpoint}/get`;
  const storageKey = `dbFetch(${url})`;
  const data = sessionStorage.getItem(storageKey);
  if (data != null) {
    return JSON.parse(data) as Database;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': DB_SECRET,
    },
  });
  const result = await res.json() as Database;
  sessionStorage.setItem(storageKey, JSON.stringify(result));
  return result;
}

function dbUpdate(db: Database): void {
  void fetch(`${dbEndpoint}/set`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': DB_SECRET,
    },
    body: JSON.stringify(db),
  });
}

export {
  boundingBox,
  Database,
  dbFetch,
  dbUpdate,
  get,
  getJsonResponse,
  LocationBox,
};
