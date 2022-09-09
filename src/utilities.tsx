import fetch, { RequestInit } from 'node-fetch';
import { computeOffset, LatLng } from 'spherical-geometry-js';
import { parseStringPromise } from 'xml2js';
import {
  dbEndpoint, DB_SECRET, proxyUrl, geocodingBaseUrl, MAPQUEST_API_KEY,
} from './constants';

type Location = {
  lat: number;
  lng: number;
};
type LatLongResponse = {
  info: {
    statusCode: number;
  };
  results: [{
    locations: [{
      latLng: Location;
    }];
  }];
};
type ParseStringData = {
  'SearchResults:searchresults' : {
    response : [{
      results: [
      {
        result: LatLongResponse;
      }];
    }];
  };
};

interface ZillowProperty {
  [propName: string]: string;
}
interface ZillowResponse {
  cat1: {
    searchResults: {
      mapResults: [ ZillowProperty ];
    };
  };
}

interface RentBitsResponse {
  data: [{
    price: string;
  }];
}

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
async function getJsonResponse(
  url: string,
  format: 'json' | 'xml' = 'json',
  useProxy = false,
  options?: RequestInit = {},
) : Promise<LatLongResponse | ZillowResponse | RentBitsResponse> {
  let fullUrl = url;
  if (useProxy) {
    fullUrl = `${proxyUrl}/${url}`;
  }
  const storageKey = `getJsonReponse(${fullUrl})`;
  const data = sessionStorage.getItem(storageKey);
  if (data != null) {
    return JSON.parse(data) as LatLongResponse | ZillowResponse | RentBitsResponse;
  }
  const blob = await fetch(fullUrl, {
    ...options,
    headers: {
      'Api-Key': DB_SECRET,
    },
  });
  let parsedData = null;
  if (format === 'json') {
    parsedData = await blob.json() as LatLongResponse | ZillowResponse | RentBitsResponse;
  } else if (format === 'xml') {
    const parsedText = await blob.text();
    parsedData = await parseStringPromise(parsedText) as ParseStringData;
    parsedData = parsedData['SearchResults:searchresults'].response[0].results[0].result;
  }
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(parsedData));
  } catch (e) {
    console.log(e);
  }
  return parsedData;
}

/**
  Fetches the lat/long of a location.

  @param location - The geo location. Could be zip code, address, state, etc.

  @returns: The coordinates of the location.
*/
async function getLatLong(location: string): Promise<Location | null> {
  const geoCodeUrl = `${geocodingBaseUrl}?key=${MAPQUEST_API_KEY}&location=${location.toLowerCase()}`;
  const { info: { statusCode }, results } = await getJsonResponse(geoCodeUrl, /* format= */'json', /* use_proxy= */true) as LatLongResponse;
  if (statusCode !== 0) {
    console.log(`Failed to retrieve lat/long data from ${location}. Status code: ${statusCode}`);
    return null;
  }
  if (results.length === 0 || results[0].locations.length === 0) {
    console.log(`Successful response with empty locations for location: ${location}`);
    return null;
  }
  const primaryResult = results[0].locations[0];
  const { lat, lng } = primaryResult.latLng;
  return { lat: Number(lat), lng: Number(lng) };
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
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(result));
  } catch (e) {
    console.log(e);
  }
  return result;
}

async function dbUpdate(db: Database): void {
  await fetch(`${dbEndpoint}/set`, {
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
  getLatLong,
  Location,
  LocationBox,
  RentBitsResponse,
  ZillowProperty,
  ZillowResponse,
};
