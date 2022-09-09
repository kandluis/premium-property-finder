import accounting from 'accounting';
import debounce from 'lodash.debounce';
import pThrottle from 'p-throttle';
import React, { useState, useMemo } from 'react';
import { useQueryParam } from 'use-query-params';
import {
  defaultRadiusSearch,
  rentBitsApiBaseUrl,
  zillowBaseUrl,
} from '../constants';
import {
  DefaultFilter,
  FilterState,
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
  const box = boundingBox(lat, lng, 5);
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
  }).filter((x) => x) as Array<number>;
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
async function fetchRentalBitsEstimates(properties: Array<Property>): Promise<Database> {
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
    newDB[prop.zpid] = {
      rentzestimate: estimate,
      zestimate: 0,
    };
  });
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
  const newProperties = properties.filter(
    (item: Property) => item.zpid && item.address && item.zipCode && item.price
      && !(item.zpid in rentalDB),
  );
  if (newProperties.length > 0) {
    const rentBitsEstimates = await fetchRentalBitsEstimates(newProperties);
    rentalDB = { ...rentalDB, ...rentBitsEstimates };
    dbUpdate(rentalDB);
  }
  const mergedProperties = properties.map((property) => {
    if (!property.zpid) {
      return property;
    }
    return { ...property, ...rentalDB[property.zpid] as Property };
  });
  return mergedProperties;
}

/**
  Parses a single property result fetched from the Zillow API for an area.ZillowDB

  @param item - The JSON object corresponding to a single property fetched from Zillow.

  @returns The parsed Property object.
 */
function parseResult(item: ZillowProperty): Property {
  const parsedItem = item;
  if (item.zpid) {
    parsedItem.zpid = Number(item.zpid);
  }
  if (item.price) {
    parsedItem.price = accounting.unformat(item.price.replace('.', '').replace(',', '')) as string;
  }
  if (item.area) {
    parsedItem.area = Number(item.area);
  }
  if (item.baths) {
    parsedItem.baths = Number(item.baths);
  }
  if (item.beds) {
    parsedItem.beds = Number(item.beds);
  }
  if (item.address && item.detailUrl) {
    // /something/address-seperated-by-city-state-zip.
    const addressComponents = item.detailUrl.split('/')[2].split('-');
    parsedItem.zipCode = Number(addressComponents[addressComponents.length - 1]);
    parsedItem.state = addressComponents[addressComponents.length - 2];
    // This is not always valid. If a city is two words, we'll only get the
    // last one! :o
    parsedItem.city = addressComponents[addressComponents.length - 3];
    parsedItem.address = addressComponents.slice(0, addressComponents.length - 3).join(' ');
  }
  if (item.listingType) {
    parsedItem.type = item.listingType;
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
async function fetchProperties(location: string, radius: number, min: number | null, max: number)
: Promise<Array<Property>> {
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
    filterState: {
      price: {
        min: min || 0,
        max,
      },
    },
  };
  const zillowUrl = `${zillowBaseUrl}?searchQueryState=${JSON.stringify(searchQueryState)}&wants=${JSON.stringify(wants)}`;
  const data = await getJsonResponse(`${zillowUrl}`, 'json', true) as ZillowResponse;
  const propertyListings = data.cat1.searchResults.mapResults;
  return propertyListings
    .map((item) => parseResult(item))
    .filter((item) => (item.zpid && item.price && item.price > 0));
  // return propertyListings;
}

interface PropertyListingsState {
  filter: FilterState,
  filteredListings: Array<Property>,
  propertyListings: Array<Property>,
  updateFilter: (filter: FilterState) => void,
  initialLoad: boolean,
  loading: boolean,
}
const DefaultState: PropertyListingsState = {
  filter: DefaultFilter,
  filteredListings: [],
  propertyListings: [],
  updateFilter: (_filter: FilterState) => {
    // no-op filter
  },
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
    return JSON.parse(atob(value)) as FilterState;
  },
};

async function filterAndFetchProperties(
  propertyListings: Property[],
  prevFilter: FilterState,
  filter: FilterState,
): Promise<{ propertyListings: Property[]; filteredListings: Property[] }> {
  const prevGeoLocation = prevFilter.geoLocation;
  const prevRadius = prevFilter.radius;
  const {
    geoLocation,
    includeLand,
    meetsRule,
    priceFrom,
    priceMost,
    radius,
    rentOnly,
    newConstruction,
    sortOrder,
  } = filter;
  // New location so we need to fetch new property listings.
  let allListings = propertyListings;
  if (prevGeoLocation !== geoLocation || prevRadius !== radius) {
    // eslint-disable-next-line max-len
    const properties = await fetchProperties(geoLocation, (radius) || defaultRadiusSearch, priceFrom, priceMost);
    const newListings = await attachRentestimates(properties);
    if (newListings) {
      allListings = newListings;
    }
  }
  let filteredListings = allListings;
  if (priceFrom) {
    filteredListings = filteredListings.filter(
      (item) => item.price && item.price >= priceFrom,
    );
  }
  if (rentOnly) {
    filteredListings = filteredListings.filter(
      (item) => item.rentzestimate && item.rentzestimate > 0,
    );
  }
  if (newConstruction) {
    filteredListings = filteredListings.filter(
      (item) => item.type && item.type === 'NEW_CONSTRUCTION',
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
      if (!item.price) {
        return !rentOnly;
      }
      const ratio = 100 * (item.rentzestimate / item.price);
      return ratio >= meetsRule;
    });
  }
  if (sortOrder !== '') {
    filteredListings = filteredListings.sort(sortFn(sortOrder));
  }
  return { allListings, filteredListings };
}

interface PropertyListingProps {
  children: React.ReactNode;
}

export function PropertyListingsProvider({ children }: PropertyListingProps) {
  const [state, setState] = useState(DefaultState);
  const [filterParams, setFilterParams] = useQueryParam('filter', FilterParams);
  const applyFilter = async (filter: FilterState): Promise<void> => {
    // Loading!
    setState({
      ...state, initialLoad: false, loading: true, filteredListings: [],
    });
    // eslint-disable-next-line max-len
    const newProperties = await filterAndFetchProperties(state.propertyListings, state.filter, filter);
    if (filter !== state.filter) {
      setFilterParams(filter, 'replace');
    }
    setState({ ...state, filter, ...newProperties });
  };
  const debouncedFilter = debounce(applyFilter, 500);
  let { filter } = state;
  if (state.initialLoad && filterParams) {
    filter = filterParams;
    const _ = debouncedFilter(filter);
  }
  const propertyListingsValue = useMemo(() => ({
    ...state,
    filter,
    updateFilter: debouncedFilter,
  }), [state, filter, debouncedFilter]);
  return (
    <PropertyListingsContext.Provider value={propertyListingsValue}>
      {children}
    </PropertyListingsContext.Provider>
  );
}

export const PropertyListingsConsumer = PropertyListingsContext.Consumer;
