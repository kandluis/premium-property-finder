import accounting from 'accounting';
import {
  DefaultFilter,
  FilterState,
  Property,
  sortFn,
} from '../common';
import {
  defaultRadiusSearch,
  rentBitsApiBaseUrl,
  ZILLOW_API_KEY,
  zillowApiBaseUrl,
  zillowBaseUrl,
} from '../constants';
import debounce from 'lodash.debounce';
import plimit from 'p-limit';
import pthrottle from 'p-throttle';
import React, { useState } from 'react';
import { useQueryParam } from 'use-query-params';
import {
  boundingBox,
  Database,
  dbFetch,
  dbUpdate,
  get,
  getJsonResponse,
  getLatLong,
  Location,
  LocationBox,
} from '../utilities';


/**
  Calculates the median known rental values in the given area using the rent bits API.

  @param box - The bounding box in which to search for property estimates.

  @returns: The estimated price or null if not possible to estimate.
*/
async function getRentBitsEstimate({ lat, lng }: Location): Promise<number | null> {
  const box = boundingBox(lat, lng, 5);
  const url = `${rentBitsApiBaseUrl}?bounds=${box.south},${box.north},${box.west},${box.east}`;
  let res;
  try {
    res = await getJsonResponse(url, 'json', true);
  } catch (e) {
    console.log(e);
    return null;
  }
  const results = get(res, 'data') as (Array<{ price?: string }> | null)
  if (results === null) {
    return null;
  }
  const prices = results.map((item) => {
    if (!item.price) {
      return null;
    }
    return accounting.unformat(item.price.replace('.', '').replace(',', ''));
  }).filter((x) => x) as Array<number>;
  if (prices.length == 0) {
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
async function fetchRentalBitsEstimates(properties: Array<Property>): Promise<Database> {
  // We only do this by zip code to reduce the load on the API.
  const zips = properties.filter((item) => item.zipCode).map((item) => item.zipCode) as number[];
  const uniqueZips = Array.from(new Set(zips));
  const rents: { [key: number]: number } = {};
  const throttle = pthrottle({ limit: 5, interval: 3000 });
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
  const _ = await Promise.all(fetch);
  // At this point we know that rents will have the right values set.
  const newDB: Database = {};
  properties.forEach((prop: Property, index: number) => {
    if (!prop.zpid || !prop.zipCode) {
      return;
    }
    const estimate = rents[prop.zipCode];
    newDB[prop.zpid] = {
      rentzestimate: estimate,
      zestimate: 0,
    };
  })
  return newDB;
}

/**
  Attaches the Zillow zestimate for rent to each propertiy.

  @param properties - The list of properties to which we attach a rental estimate.

  @returns: An array of properties with attached rental estimates.
*/
async function attachRentestimates(properties: Array<Property>): Promise<Array<Property>> {
  let rentalDB = await dbFetch();
  // Filter out any properties we won't even look at.
  // eg. no address/zip or no price. 
  const newProperties = properties.filter((item: Property) => {
    return item.zpid && item.address && item.zipCode && item.price && !(item.zpid in rentalDB);
  });
  if (newProperties.length > 0) {
    const rentBitsEstimates = await fetchRentalBitsEstimates(newProperties);
    rentalDB = { ...rentalDB, ...rentBitsEstimates };
    dbUpdate(rentalDB);
  }
  properties = properties.map((property) => {
    if (!property.zpid) {
      return property;
    }
    return { ...property, ...rentalDB[property.zpid] as Property }
  });
  return properties;
}

interface ZillowProperty {
  [propName: string]: any,
}
/**
  Parses a single property result fetched from the Zillow API for an area.ZillowDB

  @param item - The JSON object corresponding to a single property fetched from Zillow. 

  @returns The parsed Property object.
 */
function parseResult(item: ZillowProperty): Property {
  if (item.zpid) {
    item.zpid = Number(item.zpid);
  }
  if (item.price) {
    item.price = accounting.unformat(item.price.replace('.', '').replace(',', ''));
  }
  if (item.area) {
    item.area = Number(item.area);
  }
  if (item.baths) {
    item.baths = Number(item.baths);
  }
  if (item.beds) {
    item.beds = Number(item.beds);
  }
  if (item.address && item.detailUrl) {
    // /something/address-seperated-by-city-state-zip.
    const addressComponents = item.detailUrl.split('/')[2].split('-');
    item.zipCode = Number(addressComponents[addressComponents.length - 1]);
    item.state = addressComponents[addressComponents.length - 2];
    // This is not always valid. If a city is two words, we'll only get the
    // last one! :o
    item.city = addressComponents[addressComponents.length - 3];
    item.address = addressComponents.slice(0, addressComponents.length - 3).join(' ');
  }
  return item;
}

/**
  Fetches a list of properties currently for sale in the area surrounding the location.

  @remarks
  Might return properties outside the specified radius (but not by too much).

  @param location - The location name as commonly referred (eg, Google Map-able)
  @param radius - The radius around the location within which we wish to find properties.

  @returns The located properties.
*/
async function fetchProperties(location: string, radius: number): Promise<Array<Property>> {
  const coords = await getLatLong(location);
  if (coords === null) {
    return [];
  }
  const { lat, lng } = coords;
  const wants = {
    cat1: ['mapResults'],
  };
  const searchQueryState = {
    mapBounds: boundingBox(lat, lng, radius * 2),
  };
  const zillowUrl = `${zillowBaseUrl}?searchQueryState=${JSON.stringify(searchQueryState)}&wants=${JSON.stringify(wants)}`;
  const data = await getJsonResponse(`${zillowUrl}`, 'json', true);
  const propertyListings = get(data, 'cat1.searchResults.mapResults') as Array<ZillowProperty>;
  let parsedListings = propertyListings.map((item) => parseResult(item));
  parsedListings = parsedListings.filter((item) => (item.zpid && item.price && item.price > 0));
  return propertyListings;
}


interface PropertyListingsState {
  filter: FilterState,
  filteredListings: Array<Property>,
  propertyListings: Array<Property>,
  updateFilter: (filter: FilterState) => void,
  initialLoad: boolean,
  loading: boolean,
};
export interface PropertyListingsProps {
};

const DefaultState: PropertyListingsState = {
  filter: DefaultFilter,
  filteredListings: [],
  propertyListings: [],
  updateFilter: (filter: FilterState) => { return; },
  initialLoad: true,
  loading: false,
};

const PropertyListingsContext = React.createContext(DefaultState);

const FilterParams = {
  encode(value: FilterState): string {
    return btoa(JSON.stringify(value, undefined, 1));
  },
  decode(value: string | (string | null)[] | null | undefined): FilterState {
    if (!value || Array.isArray(value)) {
      return DefaultState.filter;
    }
    return JSON.parse(atob(value));
  }
}

async function filterAndFetchProperties(
  propertyListings: Property[],
  prevFilter: FilterState,
  filter: FilterState): Promise<{ propertyListings: Property[]; filteredListings: Property[] }> {
  const prevGeoLocation = prevFilter.geoLocation;
  const prevRadius = prevFilter.radius;
  const {
    geoLocation,
    includeLand,
    meetsRule,
    priceFrom,
    radius,
    rentOnly,
    sortOrder,
  } = filter;
  // New location so we need to fetch new property listings.
  if (prevGeoLocation !== geoLocation || prevRadius != radius) {
    const properties = await fetchProperties(geoLocation, (radius) || defaultRadiusSearch);
    const newListings = await attachRentestimates(properties);
    if (newListings) {
      propertyListings = newListings;
    }
  }
  let filteredListings = propertyListings;
  if (priceFrom) {
    filteredListings = propertyListings.filter((item) => {
      return item.price && item.price >= priceFrom
    });
  }
  if (rentOnly) {
    filteredListings = filteredListings.filter((item) => {
      return item.rentzestimate && item.rentzestimate > 0;
    });
  }
  if (!includeLand) {
    filteredListings = filteredListings.filter((item) => {
      return item.beds && item.baths;
    });
  }
  if (meetsRule) {
    filteredListings = filteredListings.filter((item) => {
      if (!item.rentzestimate) {
        return !rentOnly;
      }
      if (item.rentzestimate <= 0) {
        return !rentOnly;
      }
      if (!item.price) {
        return !rentOnly;
      }
      const ratio = 100 * item.rentzestimate / item.price;
      return ratio >= meetsRule;
    });
  }
  if (sortOrder !== '') {
    filteredListings = filteredListings.sort(sortFn(sortOrder));
  }
  return { propertyListings, filteredListings };
}

export function PropertyListingsProvider({ children }: any) {
  const [state, setState] = useState(DefaultState);
  const applyFilter = async (filter: FilterState): Promise<void> => {
    // Loading!
    setState({ ...state, initialLoad: false, loading: true, filteredListings: [] });
    const newProperties = await filterAndFetchProperties(
      state.propertyListings, state.filter, filter);
    if (filter !== state.filter) {
      setFilterParams(filter, 'replace');
    }
    setState({ ...state, filter, ...newProperties });
  }
  const debouncedFilter = debounce(applyFilter, 500);
  const [filterParams, setFilterParams] = useQueryParam('filter', FilterParams);
  let { filter } = state;
  if (state.initialLoad && filterParams) {
    filter = filterParams as FilterState;
    debouncedFilter(filter as FilterState);
  }
  return (
    <PropertyListingsContext.Provider value={{
      ...state,
      filter,
      updateFilter: debouncedFilter
    }} >
      {children}
    </PropertyListingsContext.Provider>
  );
}

export const PropertyListingsConsumer = PropertyListingsContext.Consumer;
