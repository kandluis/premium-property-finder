import { computeOffset, LatLng } from 'spherical-geometry-js';
import { parseStringPromise } from 'xml2js';
import { HomeType } from './common';
import {
  dbEndpoint, DB_SECRET, proxyUrl, geocodingBaseUrl, MAPQUEST_API_KEY,
} from './constants';

type Location = {
  lat: number;
  lng: number;
};
type LatLongResponse = {
  info: {
    statuscode: number;
  };
  results: {
    locations: {
      latLng: Location;
    }[];
  }[];
};
type ParseStringData = {
  'SearchResults:searchresults' : {
    response : {
      results: {
        result: LatLongResponse;
      }[];
    }[];
  };
};
type HDPHomeInfo = {
  bathrooms: number;
  bedrooms: number;
  city: string;
  country: string;
  currency: string;
  daysOnZillow: number;
  homeStatus: 'FOR_SALE';
  homeStatusForHDP: 'FOR_SALE';
  homeType: HomeType;
  isFeatured: boolean;
  isNonOwnerOccupied: boolean;
  isPreforeclosureAuction: boolean;
  isPremierBuilder: boolean;
  isUnmappable: boolean;
  isZillowOwned: boolean;
  latitude: number;
  listing_sub_type: {
    is_FSB:boolean;
  };
  livingArea: number;
  longitude: number;
  price: number;
  priceForHDP: number;
  rentZestimate: number;
  shouldHighlight: boolean;
  state: string;
  unit: string;
  zestimate: number;
  zipcode: string;
  zpid: number;
};

interface ZillowProperty {
  // Fields that are always present!
  address: string;
  detailUrl: string;
  has3DModel: boolean;
  hasAdditionalAttributions: boolean;
  hasImage: boolean;
  imgSrc: string;
  isFavorite: boolean;
  isFeaturedListing: boolean;
  latLong: {
    latitud: number,
    longitud: number
  };
  listingType: string;
  price: string;
  statusText: string;
  statusType: string;
  variableData: object;

  // Optional fields.
  area?: number;
  availabilityDate?: string | null;
  badgeInfo?: string | null;
  baths?: number;
  beds?: number;
  buildingId?: string;
  canSaveBuilding?: boolean;
  communityName?: string;
  hasVideo?: boolean;
  hdpData?: {
    homeInfo: HDPHomeInfo;
  };
  isBuilding?: boolean;
  isCdpResult?: boolean;
  isHomeRec?: boolean;
  isPropertyResultCDP: boolean;
  isUserClaimingOwner?: boolean;
  isUserConfirmedClaim?: boolean;
  lotAreaString?: string;
  lotId?: string;
  minArea?: number;
  minBaths?: number;
  minBeds?: number;
  pgapt?: string;
  priceLabel?: string;
  sgapt?: string;
  style?: string,
  unitCount?: number;
  visited?: boolean;
  zpid?: string;
}
interface categoryTotal {
  totalResultCount: number;
}
interface ZillowResponse {
  cat1: {
    homeRecCount: number;
    showForYouContent: number;
    searchResults: {
      mapResults: ZillowProperty[];
    };
  };
  categoryTotals: {
    cat1: categoryTotal;
    cat2: categoryTotal;
  };
  mapState: {
    customRegionPolygonWkt: null;
    isCurrentLocationSearch: boolean;
    schoolPolygonWkt: null;
    userPosition: Location;
  };
  regionState: {
    regionInfo: string[];
  };
  searchPageSeoObject: {
    baseUrl: string;
    metaDescription: string;
    windowTitle: string;
  };
  user: {
    guid: string;
    hasHousingConnectorPermission: boolean;
    isBot: boolean;
    isLoggedIn: boolean;
    personalizedSearchGaDataTag: string | null;
    personalizedSearchTraceID: string;
    savedHomesCount: number,
    savedSearchCount: number;
    searchPageRenderedCount: number;
    userSpecializedSEORegion: boolean;
    zuid: string
  };
}

interface RentBitsResponse {
  data: {
    price: string;
  }[];
}
interface CuttlyApiResponse {
  url: {
    shortLink: string;
    status: number;
  };
}
type AppResponse = LatLongResponse | ZillowResponse | RentBitsResponse | CuttlyApiResponse;

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
  options: RequestInit = {},
) : Promise<AppResponse> {
  let fullUrl = url;
  if (useProxy) {
    fullUrl = `${proxyUrl}/${url}`;
  }
  const storageKey = `getJsonReponse(${fullUrl})`;
  const data = sessionStorage.getItem(storageKey);
  if (data != null) {
    return JSON.parse(data) as AppResponse;
  }
  const blob = await fetch(fullUrl, {
    ...options,
    headers: {
      'Api-Key': DB_SECRET,
    },
  });
  const fetchParsed = async (): Promise<AppResponse> => {
    if (format === 'json') {
      return blob.json() as Promise<AppResponse>;
    }
    const parsedText = await blob.text();
    const parsedData = await parseStringPromise(parsedText) as ParseStringData;
    return parsedData['SearchResults:searchresults'].response[0].results[0].result;
  };
  const parsedData = await fetchParsed();
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
  const { info: { statuscode }, results } = await getJsonResponse(geoCodeUrl, /* format= */'json', /* use_proxy= */true) as LatLongResponse;
  if (statuscode !== 0) {
    console.log(`Failed to retrieve lat/long data from ${location}. Status code: ${statuscode}`);
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
    zestimate?: number,
  },
}
/**
  Fetches database of rental estimates.

  @returns: A Database object contaiing known zpid and relevant information.
*/
async function dbFetch(): Promise<Database> {
  const url = `${dbEndpoint}/get`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': DB_SECRET,
    },
  });
  const result = await res.json() as Database;
  return result;
}

async function dbUpdate(db: Database): Promise<void> {
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
  CuttlyApiResponse,
  Database,
  dbFetch,
  dbUpdate,
  getJsonResponse,
  getLatLong,
  HDPHomeInfo,
  Location,
  LocationBox,
  RentBitsResponse,
  ZillowProperty,
  ZillowResponse,
};
