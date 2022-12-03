import accounting from 'accounting';
import debounce from 'lodash/debounce';
import merge from 'lodash/merge';
import pThrottle from 'p-throttle';
import React, { useMemo, useCallback, useState } from 'react';
import {
  rentBitsApiBaseUrl,
  zillowBaseUrl,
} from '../constants';
import {
  DefaultLocalSettings,
  FetchPropertiesRequest,
  LocalFilterSettings,
  notEmpty,
  PlaceInfo,
  Property,
  sortFn,
} from '../common';
import {
  boundingBox,
  Database,
  dbFetch,
  dbUpdate,
  getJsonResponse,
  getLatLong,
  HDPHomeInfo,
  Location,
  RentBitsResponse,
  ZillowProperty,
  ZillowResponse,
} from '../utilities';

type ProgressFn = (_action: number | ((_prev: number) => number)) => void;

/**
  Calculates the median known rental values in the given area using the rent bits API.

  @param box - The bounding box in which to search for property estimates.

  @returns The estimated price or null if not possible to estimate.
*/
async function getRentBitsEstimate({ lat, lng }: Location): Promise<number | null> {
  const box = boundingBox(lat, lng, 1);
  const url = `${rentBitsApiBaseUrl}?bounds=${box.south},${box.north},${box.west},${box.east}`;
  let res = null;
  try {
    res = await getJsonResponse(url, 'json', true) as RentBitsResponse;
  } catch (e) {
    return null;
  }
  if (res.data === null) {
    return null;
  }
  const prices = res.data.map((item: { price? : string}) => {
    if (!item.price) {
      return null;
    }
    return accounting.unformat(item.price.replace('.', '').replace(',', ''));
  }).filter((x) => x) as number[];
  if (prices.length === 0) {
    return null;
  }
  const mid = Math.floor(prices.length / 2);
  const sorted = [...prices].sort((a, b) => a - b);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
  Fetches the rental estimates from bits rental API.

  @param properties - The properties for which to try and fetch a rental estimate.
  @param progressFn - Function to update progress. This function takes care of
    going from [25%, 35%].

  @returns The database containing the estimated prices for each property.
*/
async function fetchRentalBitsEstimates(
  properties: Property[],
  progressFn: ProgressFn,
): Promise<Database> {
  progressFn(0.35);
  // We only do this by zip code to reduce the load on the API.
  const zips = properties.filter((item) => item.zipCode).map((item) => item.zipCode) as number[];
  const uniqueZips = Array.from(new Set(zips));
  const rents: { [key: number]: number } = {};
  const throttle = pThrottle({ limit: 5, interval: 3000 });
  const throttled = throttle(getRentBitsEstimate);
  let processed = 0;
  const fetch = uniqueZips.map(async (zipCode: number) => {
    const location = await getLatLong(`${zipCode}`);
    if (location === null) {
      processed += 1;
      progressFn(0.25 + (0.35 - 0.25) * (processed / (1 + uniqueZips.length)));
      return false;
    }
    const rent = await throttled(location);
    if (rent === null) {
      processed += 1;
      progressFn(0.25 + (0.35 - 0.25) * (processed / (1 + uniqueZips.length)));
      return false;
    }
    rents[zipCode] = rent;
    processed += 1;
    progressFn(0.25 + (0.35 - 0.25) * (processed / (1 + uniqueZips.length)));
    return true;
  });
  await Promise.all(fetch);
  progressFn(0.35);
  // At this point we know that rents will have the right values set.
  return properties.reduce((db: Database, { zpid, zipCode }: Property) => {
    if (!zpid || !zipCode) {
      return db;
    }
    const estimate = rents[zipCode];
    if (!estimate) {
      return db;
    }
    return merge(db, { [zpid]: { rentzestimate: estimate } });
  }, {});
}

/**
  Fetch the Zillow rentzestimate for rent to each propertiy.

  @param properties - The list of properties to which we attach a rental estimate.
  @param progressFn - Function to call to update progress of fetching.
    This takes care of going from [20, 40].

  @returns A Database containing newly fetched rental estimates for
    any properties that needed it out of the passed-in properties.
*/
async function fetchRentEstimates(
  properties: Property[],
  progressFn: ProgressFn,
): Promise<Database> {
  progressFn(0.2);
  const needRentEstimates = properties.filter(
    (item: Property) => (
      // Properties we can identify and compute ratio.
      item.zpid && item.address && item.zipCode && item.price
      // Properties that don't already have rentzestimate.
      && !(item.rentzestimate)
    ),
  );
  let db = {};
  if (needRentEstimates.length > 0) {
    db = await fetchRentalBitsEstimates(needRentEstimates, progressFn);
  }
  progressFn(0.4);
  return db;
}

/**
 Parses the price label at best effort.
*/
function parsePrice(item: ZillowProperty): number {
  if (item.price.length === 0) {
    return 0;
  }
  let localPrice = item.price;
  if (localPrice[localPrice.length - 1].toUpperCase() === 'M') {
    // Only concat 5-zeros since we might include a '.'
    localPrice = localPrice.replace('M', '').concat('00000');
    if (localPrice.includes('.')) {
      localPrice = localPrice.replace('.', '');
    } else {
      // The missing zero.
      localPrice = localPrice.concat('0');
    }
  }
  return accounting.unformat(localPrice.replace(',', ''));
}

/**
  Adds a single HDP property result fetched from the Zillow API for an area.

  @param parsedItem - The partially parsed item to which we add HDP data.
  @param home - The HDP home information object.
 */
function addHDPResults(parsedItem: Property, home: HDPHomeInfo): void {
  const local = parsedItem;
  local.baths = home.bathrooms;
  local.beds = home.bedrooms;
  local.city = home.city;
  local.homeType = home.homeType;
  local.livingArea = home.livingArea;
  if (home.price) {
    local.price = home.price;
  }
  local.rentzestimate = home.rentZestimate;
  local.state = home.state;
  local.zestimate = home.zestimate;
  local.zipCode = Number(home.zipcode);
  local.zpid = home.zpid;
}
// Adds same fields as above function but when we don't have HDP data.
function addResults(parsedItem: Property, item: ZillowProperty): void {
  const local = parsedItem;
  if (item.baths || item.minBaths) {
    local.baths = Number(item.baths || item.minBaths);
  }
  if (item.beds || item.minBeds) {
    local.beds = Number(item.beds || item.minBeds);
  }
  if (item.zpid) {
    local.zpid = Number(item.zpid);
  }
}

/**
  Parses a single property result fetched from the Zillow API for an area.ZillowDB

  @param item - The JSON object corresponding to a single property fetched from Zillow.

  @returns The parsed Property object.
 */
function parseResult(item: ZillowProperty): Property {
  const parsedItem: Property = {
    address: item.address,
    detailUrl: item.detailUrl,
    imgSrc: item.imgSrc,
    listingType: item.listingType,
    price: parsePrice(item),
    statusText: item.statusText,
    statusType: item.statusType,
  };
  if (item.statusType === 'SOLD' && item.variableData) {
    parsedItem.lastSold = item.variableData.text;
  }
  // /something/address-seperated-by-city-state-zip.
  const addressComponents = item.detailUrl.split('/')[2].split('-');
  // These are best-effort. If we have more data, it gets replaced later.
  parsedItem.zipCode = Number(addressComponents[addressComponents.length - 1]);
  parsedItem.state = addressComponents[addressComponents.length - 2];
  // This is not always valid. If a city is two words, we'll only get the
  // last one! :o
  parsedItem.city = addressComponents[addressComponents.length - 3];
  parsedItem.address = addressComponents.slice(0, addressComponents.length - 3).join(' ');
  if (item.area || item.minArea) {
    parsedItem.area = Number(item.area || item.minArea);
  }
  if (item.lotAreaString) {
    parsedItem.lotArea = Number(item.lotAreaString);
  }
  if (item.hdpData) {
    addHDPResults(parsedItem, item.hdpData.homeInfo);
  } else {
    addResults(parsedItem, item);
  }
  return parsedItem;
}

/**
  Fetches a list of properties currently for sale in the area surrounding the location.

  @remarks
  Might return properties outside the specified radius (but not by too much).

  @param location - The location name as commonly referred (eg, Google Map-able)
  @param radius - The radius around the location within which we wish to find properties.

  @returns The located properties.
*/
async function fetchProperties(
  geoLocation: string,
  radius: number,
  priceFrom: number,
  priceMost: number,
  includeForSale: boolean,
  includeRecentlySold: boolean,
  sinceSaleFilter: string | null,
  progressFn: ProgressFn,
)
: Promise<Property[]> {
  const coords = await getLatLong(geoLocation);
  if (coords === null) {
    return [];
  }
  progressFn(0.05);
  const { lat, lng } = coords;
  const wants = {
    cat1: ['mapResults'],
  };
  const searchQueryStateFn = ({ isRecentlySold }: { isRecentlySold: boolean }) => ({
    mapBounds: boundingBox(lat, lng, radius * 2),
    filterState: {
      price: {
        min: priceFrom,
        max: priceMost,
      },
      isAllHomes: { value: true },
      isRecentlySold: { value: isRecentlySold },
      isForSaleByAgent: { value: !isRecentlySold },
      isForSaleByOwner: { value: !isRecentlySold },
      isNewConstruction: { value: !isRecentlySold },
      isComingSoon: { value: !isRecentlySold },
      isAuction: { value: !isRecentlySold },
      isForSaleForeclosure: { value: !isRecentlySold },
      doz: (sinceSaleFilter) ? { value: sinceSaleFilter } : undefined,
    },
  });
  let propertyListings: ZillowProperty[] = [];
  if (includeForSale) {
    const zillowUrl = `${zillowBaseUrl}?searchQueryState=${JSON.stringify(searchQueryStateFn({ isRecentlySold: false }))}&wants=${JSON.stringify(wants)}`;
    const data = await getJsonResponse(`${zillowUrl}`, 'json', true) as ZillowResponse;
    propertyListings = [...propertyListings, ...data.cat1.searchResults.mapResults];
  }
  progressFn(0.1);
  if (includeRecentlySold) {
    const zillowUrl = `${zillowBaseUrl}?searchQueryState=${JSON.stringify(searchQueryStateFn({ isRecentlySold: true }))}&wants=${JSON.stringify(wants)}`;
    const data = await getJsonResponse(`${zillowUrl}`, 'json', true) as ZillowResponse;
    propertyListings = [...propertyListings, ...data.cat1.searchResults.mapResults];
  }
  progressFn(0.15);
  const ret = propertyListings
    .map((item) => parseResult(item))
    .filter((item) => (item.zpid));
  progressFn(0.25);
  return ret;
}

/**
  Filters the given properties by the provided filter.

  @param all - A complete list of all properties currently available.
  @param settings - The locally-filterable options to use for filtering.

  @returns The properties matching the filters.
*/
function filterProperties(all: Property[], settings: LocalFilterSettings): Property[] {
  let filteredListings = [...all];
  const {
    homeTypes,
    includeLand,
    meetsRule,
    newConstruction,
    rentOnly,
  } = settings;

  if (rentOnly) {
    filteredListings = filteredListings.filter(
      (item) => item.rentzestimate && item.rentzestimate > 0,
    );
  }
  if (newConstruction) {
    filteredListings = filteredListings.filter(
      (item) => item.listingType && item.listingType === 'NEW_CONSTRUCTION',
    );
  }
  if (!includeLand) {
    filteredListings = filteredListings.filter(
      (item) => item.beds && item.baths,
    );
  }
  const [minR, maxR] = meetsRule;
  const [minRBound, maxRBound] = DefaultLocalSettings.meetsRule;
  filteredListings = filteredListings.filter((item) => {
    if (!item.rentzestimate) {
      return !rentOnly;
    }
    if (item.rentzestimate <= 0) {
      return !rentOnly;
    }
    if (!item.price && !item.zestimate) {
      return !rentOnly;
    }
    const ratio = 100 * (item.rentzestimate / (item.price || item.rentzestimate));
    return (minR === minRBound || minR <= ratio) && (maxR === maxRBound || ratio <= maxR);
  });
  if (homeTypes) {
    const selectedTypes = homeTypes.map((type) => type.replace(' ', '_').toUpperCase());
    filteredListings = filteredListings.filter(
      (item) => item.homeType && selectedTypes.includes(item.homeType),
    );
  }
  return filteredListings;
}

/*
  @retuns: A date for next Tuesday 8:10 AM local time.
*/
function getNextTuesdayDeparture(): Date {
  const dayInMill = 1000 * 60 * 60 * 24;
  const TUESDAY = 2;
  const currDate = new Date();
  let departureDate = currDate;
  if (currDate.getDay() !== TUESDAY
    || (currDate.getHours() > 8
      || (currDate.getHours() === 8 && currDate.getMinutes() > 10))) {
    // Get next Tuesday.
    departureDate = new Date(currDate.getTime() + dayInMill);
    while (departureDate.getDay() !== TUESDAY) {
      departureDate = new Date(departureDate.getTime() + dayInMill);
    }
  }
  departureDate.setHours(8);
  departureDate.setMinutes(10);
  return departureDate;
}

type Value = {
  value: number;
  text: string;
};
type DistanceMatrixResponse = {
  originAddresses: string[];
  destinationAddresses: string[];
  rows: {
    elements: {
      status: string;
      duration: Value;
      distance: Value;
      duration_in_traffic: Value;
    }[];
  }[];
};

/*
  Fetch distance to commute location if specified.

  @param props - The properties for which we want to estimate commute times to.
  @param destination - The destination location for travel time estimates.
  @param progressFn - Function to update request progress. This function takes
    progress from [40% to 90%].

  @returns: An database of new commute times for properties which do not have
    them, as provided in props.
*/
async function fetchCommuteTimes(
  props: Property[],
  { placeId }: PlaceInfo,
  progressFn: ProgressFn,
): Promise<Database> {
  progressFn(0.4);
  const genOrigin = ({
    address, city, state, zipCode,
  }: Property) => (city && state && zipCode ? `${address} ${city}, ${state} ${zipCode}` : null);
  const needCommute = props.filter((prop) => !prop.travelTime);
  const allOrigins = needCommute.map(genOrigin).filter(notEmpty);
  const drivingOptions = {
    departureTime: getNextTuesdayDeparture(),
    trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
  };
  const request = {
    drivingOptions,
    destinations: [{ placeId }],
    travelMode: window.google.maps.TravelMode.DRIVING,
    unitSystem: window.google.maps.UnitSystem.IMPERIAL,
  };
  // We can only process 25 origins at a time. Generate all requests.
  const requests = [];
  let startIdx = 0;
  while (startIdx < allOrigins.length) {
    requests.push({
      ...request,
      origins: allOrigins.slice(startIdx, startIdx + 25),
    });
    startIdx += 25;
  }
  const throttle = pThrottle({
    limit: 1, interval: 2000, strict: true,
  });
  const get = throttle((req: any): Promise<DistanceMatrixResponse> => new Promise((resolve, reject) => { // eslint-disable-line
    const service = new window.google.maps.DistanceMatrixService();
    service.getDistanceMatrix(req, (response, status) => { // eslint-disable-line
      if (status !== 'OK' || !response) {
        return reject(status);
      }
      return resolve(response);
    });
  }));
  let processed = 0;
  const result = await Promise.allSettled(requests.map(async (req) => {
    const res = await get(req);
    processed += 1;
    progressFn(0.4 + (0.9 - 0.4) * (processed / (1 + requests.length)));
    return res;
  }));
  progressFn(0.9);
  return needCommute.reduce((db: Database, { zpid }: Property, idx: number) => {
    const resp = result[Math.floor(idx / 25)];
    if (resp.status !== 'fulfilled') {
      return db;
    }
    const { value: { rows } } = resp;
    const { elements } = rows[idx % 25];
    const { status } = elements[0];
    if (status !== 'OK') {
      return db;
    }
    if (!zpid) {
      return db;
    }
    const { duration_in_traffic: { value } } = elements[0];
    return merge(db, { [zpid]: { [placeId]: value } });
  }, {});
}

/*
  Fetchers remote properties as per FetchPropertiesRequest.

  @param req - The remote property request with details required to fetch.
  @param progressFn - Function to call when making progress on request. We
    take care of going from [0%, 100%] progress.

  @returns
*/
async function filterAndFetchProperties(
  {
    geoLocation, radius, priceFrom, priceMost, includeRecentlySold,
    includeForSale, sinceSaleFilter, commuteLocation,
  }: FetchPropertiesRequest,
  progressFn: ProgressFn,
): Promise<Property[]> {
  const properties = await fetchProperties(
    geoLocation.description,
    radius,
    priceFrom,
    priceMost,
    includeRecentlySold,
    includeForSale,
    sinceSaleFilter,
    progressFn,
  );
  // Fetch additional, costly API data from database and update results.
  progressFn(0.0);
  let db = await dbFetch();
  progressFn(0.1);
  const updateProp = (prop: Property): Property => {
    if (!prop.zpid || !(prop.zpid in db)) {
      return prop;
    }
    const updates = {
      zestimate: db[prop.zpid].zestimate,
      rentzestimate: db[prop.zpid].rentzestimate,
      travelTime: db[prop.zpid][commuteLocation.placeId],
    };
    return { ...prop, ...updates };
  };
  const updatedProps = properties.map(updateProp);

  // Update database with unknown values and merge into properties.
  db = merge(db, await fetchRentEstimates(updatedProps, progressFn));
  if (commuteLocation.placeId) {
    db = merge(db, await fetchCommuteTimes(updatedProps, commuteLocation, progressFn));
  }
  const finalProps = properties.map(updateProp);

  // Update the database.
  db = properties.reduce((prevDB, {
    zpid, zestimate, rentzestimate, travelTime,
  }) => {
    if (!zpid) {
      return prevDB;
    }
    return merge(prevDB, {
      [zpid]: { zestimate, rentzestimate, [commuteLocation.placeId]: travelTime },
    });
  }, db);
  // Fire and forget.
  progressFn(0.95);
  const _ = dbUpdate(db);
  progressFn(1);
  return finalProps;
}

interface ProviderProps {
  children: React.ReactNode;
}
const ContextState = {
  loading: false,
  percent: 0,
  filteredProperties: [] as Property[],
  allProperties: [] as Property[],
  localUpdate: (_: LocalFilterSettings) => {
    // no-op
  },
  remoteUpdate: (_: FetchPropertiesRequest) => {
    // no-op
  },
  displayType: 'Grid' as 'Grid' | 'Table',
  setDisplayType: (_: 'Grid' | 'Table') => {
    // no-op
  },
};
const ProviderDefaultState = {
  loading: false,
  allProperties: [] as Property[],
};
const PropertyListingsContext = React.createContext(ContextState);

export function PropertyListingsProvider({ children }: ProviderProps) {
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([] as Property[]);
  const [state, setState] = useState(ProviderDefaultState);
  const [percent, setPercent] = useState(0);
  const [displayType, setDisplayType] = useState<'Grid' | 'Table'>('Grid');

  const localUpdate = useCallback((settings: LocalFilterSettings): void => {
    const { sortOrder } = settings;
    // Sort orders are reversed since this enables reasonable multi-sort.
    sortOrder.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    setFilteredProperties(
      sortOrder.reduce(
        (acc, order) => acc.sort(sortFn(order)),
        filterProperties(state.allProperties, settings),
      ),
    );
  }, [state.allProperties]);

  const remoteUpdate = useMemo(() => {
    const fetchFn = async (req: FetchPropertiesRequest): Promise<void> => {
      setState({
        allProperties: [] as Property[],
        loading: true,
      });
      setPercent(0);
      const allProperties = await filterAndFetchProperties(req, setPercent);
      setState({
        allProperties,
        loading: false,
      });
      setPercent(1);
    };
    // Fetch gits triggered on any change. Give 1 sec between keys.
    return debounce(fetchFn, 1000);
  }, []);
  const propertyListingsValue = useMemo(() => ({
    loading: state.loading,
    allProperties: state.allProperties,
    filteredProperties,
    localUpdate,
    percent,
    remoteUpdate,
    displayType,
    setDisplayType,
  }), [
    state.loading,
    state.allProperties,
    filteredProperties,
    localUpdate,
    percent,
    remoteUpdate,
    displayType,
    setDisplayType,
  ]);
  return (
    <PropertyListingsContext.Provider value={propertyListingsValue}>
      {children}
    </PropertyListingsContext.Provider>
  );
}

export const PropertyListingsConsumer = PropertyListingsContext.Consumer;
