import accounting from 'accounting';
import debounce from 'lodash.debounce';
import pThrottle from 'p-throttle';
import React, { useMemo, useCallback, useState } from 'react';
import {
  rentBitsApiBaseUrl,
  zillowBaseUrl,
} from '../constants';
import {
  FetchPropertiesRequest,
  LocalFilterSettings,
  notEmpty,
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

/**
  Calculates the median known rental values in the given area using the rent bits API.

  @param box - The bounding box in which to search for property estimates.

  @returns: The estimated price or null if not possible to estimate.
*/
async function getRentBitsEstimate({ lat, lng }: Location): Promise<number | null> {
  const box = boundingBox(lat, lng, 1);
  const url = `${rentBitsApiBaseUrl}?bounds=${box.south},${box.north},${box.west},${box.east}`;
  let res = null;
  try {
    res = await getJsonResponse(url, 'json', true) as RentBitsResponse;
  } catch (e) {
    console.log(e);
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

  @param properties: The properties for which to try and fetch a rental estimate.

  @returns: The database containing the estimated prices for each property.
*/
async function fetchRentalBitsEstimates(properties: Property[]): Promise<Database> {
  // We only do this by zip code to reduce the load on the API.
  const zips = properties.filter((item) => item.zipCode).map((item) => item.zipCode) as number[];
  const uniqueZips = Array.from(new Set(zips));
  const rents: { [key: number]: number } = {};
  const throttle = pThrottle({ limit: 5, interval: 3000 });
  const throttled = throttle(getRentBitsEstimate);
  const fetch = uniqueZips.map(async (zipCode: number) => {
    const location = await getLatLong(`${zipCode}`);
    if (location === null) {
      return false;
    }
    const rent = await throttled(location);
    if (rent === null) {
      return false;
    }
    rents[zipCode] = rent;
    return true;
  });
  await Promise.all(fetch);
  // At this point we know that rents will have the right values set.
  const newDB: Database = {};
  properties.forEach((prop: Property) => {
    if (!prop.zpid || !prop.zipCode) {
      return;
    }
    const estimate = rents[prop.zipCode];
    if (estimate) {
      newDB[prop.zpid] = {
        rentzestimate: estimate,
      };
    }
  });
  return newDB;
}

/**
  Attaches the Zillow zestimate for rent to each propertiy.

  @param properties - The list of properties to which we attach a rental estimate.

  @returns: An array of properties with attached rental estimates.
*/
async function attachRentestimates(properties: Property[]): Promise<Property[]> {
  let rentalDB = await dbFetch();
  properties.forEach(
    ({ zpid, rentzestimate }) => {
      if (zpid && rentzestimate) {
        rentalDB[zpid] = { ...rentalDB[zpid], rentzestimate };
      }
    },
  );
  const needRentEstimates = properties.filter(
    (item: Property) => (
      // Properties we can identify and compute ratio.
      item.zpid && item.address && item.zipCode && item.price
      // Properties not already in our database (eg, we don't refresh estimates)
      && !(item.zpid in rentalDB)
    ),
  );
  if (needRentEstimates.length > 0) {
    const rentBitsEstimates = await fetchRentalBitsEstimates(needRentEstimates);
    rentalDB = { ...rentalDB, ...rentBitsEstimates };
  }
  // Async background update.
  const _ = dbUpdate(rentalDB);
  const mergedProperties = properties.map((property: Property) => {
    if (!property.zpid) {
      return property;
    }
    return { ...property, ...rentalDB[property.zpid] };
  });
  return mergedProperties;
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
  includeRecentlySold: boolean,
)
: Promise<Property[]> {
  const coords = await getLatLong(geoLocation);
  if (coords === null) {
    return [];
  }
  const { lat, lng } = coords;
  const wants = {
    cat1: ['mapResults'],
  };
  const searchQueryStateFn = (isRecentlySold: boolean) => ({
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
    },
  });
  let zillowUrl = `${zillowBaseUrl}?searchQueryState=${JSON.stringify(searchQueryStateFn(false))}&wants=${JSON.stringify(wants)}`;
  let data = await getJsonResponse(`${zillowUrl}`, 'json', true) as ZillowResponse;
  let propertyListings = data.cat1.searchResults.mapResults;
  if (includeRecentlySold) {
    zillowUrl = `${zillowBaseUrl}?searchQueryState=${JSON.stringify(searchQueryStateFn(true))}&wants=${JSON.stringify(wants)}`;
    data = await getJsonResponse(`${zillowUrl}`, 'json', true) as ZillowResponse;
    propertyListings = [...propertyListings, ...data.cat1.searchResults.mapResults];
  }
  return propertyListings
    .map((item) => parseResult(item))
    .filter((item) => (item.zpid));
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
    homeType,
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
  if (meetsRule) {
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
      return ratio >= meetsRule;
    });
  }
  if (homeType !== 'All') {
    filteredListings = filteredListings.filter((item) => item.homeType === homeType.replace(' ', '_').toUpperCase());
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
  Attach distance to commute location if specified.

  @param props - The properties for which we want to estimate commute times to.
  @param destination - The destination location for travle time estimates.

  @returns: An array of properties equivalent to `props` but with attached
    travel times estimates if available.
*/
async function attachCommuteTimes(props: Property[], destination: string): Promise<Property[]> {
  const genOrigin = ({
    address, city, state, zipCode,
  }: Property) => (city && state && zipCode ? `${address} ${city}, ${state} ${zipCode}` : null);
  const allOrigins = props.map(genOrigin).filter(notEmpty);
  const drivingOptions = {
    departureTime: getNextTuesdayDeparture(),
    trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
  };
  const request = {
    drivingOptions,
    destinations: [destination],
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
  const service = new window.google.maps.DistanceMatrixService();
  const get = (req: any): Promise<DistanceMatrixResponse> => new Promise((resolve, reject) => { // eslint-disable-line
    service.getDistanceMatrix(req, (response, status) => { // eslint-disable-line
      if (status !== 'OK' || !response) {
        return reject(status);
      }
      return resolve(response);
    });
  });
  const result = await Promise.allSettled(requests.map(get));
  return props.map((prop: Property, idx: number) => {
    const resp = result[Math.floor(idx / 25)];
    if (resp.status !== 'fulfilled') {
      return prop;
    }
    const { value: { rows } } = resp;
    const { elements } = rows[idx % 25];
    const { status, duration_in_traffic: { value } } = elements[0];
    if (status !== 'OK') {
      return prop;
    }
    return { ...prop, travelTime: value };
  });
}

async function filterAndFetchProperties(
  {
    geoLocation, radius, priceFrom, priceMost, includeRecentlySold,
    commuteLocation,
  }: FetchPropertiesRequest,
): Promise<Property[]> {
  const properties = await fetchProperties(
    geoLocation,
    radius,
    priceFrom,
    priceMost,
    includeRecentlySold,
  );
  const propsWithRents = await attachRentestimates(properties);
  if (!commuteLocation) {
    return propsWithRents;
  }
  return attachCommuteTimes(propsWithRents, commuteLocation);
}

interface ProviderProps {
  children: React.ReactNode;
}
const ContextState = {
  loading: false,
  filteredProperties: [] as Property[],
  localUpdate: (_: LocalFilterSettings) => {
    // no-op
  },
  remoteUpdate: (_: FetchPropertiesRequest) => {
    // no-op
  }
  ,
};
const ProviderDefaultState = {
  loading: false,
  allProperties: [] as Property[],
};
const PropertyListingsContext = React.createContext(ContextState);

export function PropertyListingsProvider({ children }: ProviderProps) {
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([] as Property[]);
  const [state, setState] = useState(ProviderDefaultState);

  const localUpdate = useCallback((settings: LocalFilterSettings): void => {
    // This is a round-about way to enable sorts stacking. Since
    // .sort is stable, if we first sort by 'r/p ratio asc' and then we sort
    // by 'price asc', then properties with the same price will internally
    // be sorted by 'r/p ration asc.
    state.allProperties = state.allProperties.sort(sortFn(settings.sortOrder));
    setFilteredProperties(filterProperties(state.allProperties, settings));
  }, [state]);

  const remoteUpdate = useMemo(() => {
    const fetchFn = async (req: FetchPropertiesRequest): Promise<void> => {
      setState({
        allProperties: [] as Property[],
        loading: true,
      });
      // eslint-disable-next-line max-len
      const allProperties = await filterAndFetchProperties(req);
      setState({
        allProperties,
        loading: false,
      });
    };
    // Fetch gits triggered on any change. Give 1 sec between keys.
    return debounce(fetchFn, 1000);
  }, []);
  const propertyListingsValue = useMemo(() => ({
    loading: state.loading,
    filteredProperties,
    localUpdate,
    remoteUpdate,
  }), [state.loading, filteredProperties, localUpdate, remoteUpdate]);
  return (
    <PropertyListingsContext.Provider value={propertyListingsValue}>
      {children}
    </PropertyListingsContext.Provider>
  );
}

export const PropertyListingsConsumer = PropertyListingsContext.Consumer;
