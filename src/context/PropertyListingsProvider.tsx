import accounting from 'accounting';
import debounce from 'lodash.debounce';
import pThrottle from 'p-throttle';
import React, { useMemo, useCallback, useState } from 'react';
import {
  rentBitsApiBaseUrl,
  zillowBaseUrl,
} from '../constants';
import {
  LocalFilterSettings,
  FetchPropertiesRequest,
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
async function fetchProperties(
  geoLocation: string,
  radius: number,
  priceFrom: number,
  priceMost: number,
)
: Promise<Array<Property>> {
  const coords = await getLatLong(geoLocation);
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
        min: priceFrom,
        max: priceMost,
      },
    },
  };
  const zillowUrl = `${zillowBaseUrl}?searchQueryState=${JSON.stringify(searchQueryState)}&wants=${JSON.stringify(wants)}`;
  const data = await getJsonResponse(`${zillowUrl}`, 'json', true) as ZillowResponse;
  const propertyListings = data.cat1.searchResults.mapResults;
  return propertyListings
    .map((item) => parseResult(item))
    .filter((item) => (item.zpid && item.price && item.price > 0));
}

/**
  Filters the given properties by the provided filter.

  @param all - A complete list of all properties currently available.
  @param settings - The locally-filterable options to use for filtering.

  @returns The properties matching the filters.
*/
function filterProperties(all: [Property], settings: LocalFilterSettings): [Property] {
  let filteredListings = [...all];
  const {
    meetsRule,
    rentOnly,
    newConstruction,
    includeLand,
    sortOrder,
  } = settings;

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
  return filteredListings;
}

async function filterAndFetchProperties(
  {
    geoLocation, radius, priceFrom, priceMost,
  }: FetchPropertiesRequest,
): Promise<[Property]> {
  const properties = await fetchProperties(
    geoLocation,
    radius,
    priceFrom,
    priceMost,
  );
  const withRents = await attachRentestimates(properties);
  return withRents.filter(
    (item) => !item.price || (item.price && item.price >= priceFrom),
  );
}

interface ProviderProps {
  children: React.ReactNode;
}
const ContextState = {
  loading: false,
  filteredProperties: [] as [Property],
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
  allProperties: [],
};
const PropertyListingsContext = React.createContext(ContextState);

export function PropertyListingsProvider({ children }: ProviderProps) {
  const [filteredProperties, setFilteredProperties] = useState<[Property]>([]);
  const [state, setState] = useState(ProviderDefaultState);

  const localUpdate = useCallback((settings: LocalFilterSettings): void => {
    setFilteredProperties(filterProperties(state.allProperties, settings));
  }, [state.allProperties]);

  const remoteUpdate = useMemo(() => {
    const fetchFn = async (req: FetchPropertiesRequest): Promise<void> => {
      setState({
        allProperties: [],
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
