import accounting from 'accounting';
import { sortFn, DefaultFilter, FilterState, Property } from '../common';
import {
  defaultRadiusSearch, zillowApiBaseUrl, zillowBaseUrl, ZILLOW_API_KEY, rentBitsApiBaseUrl,
} from '../constants';
import debounce from 'lodash.debounce';
import plimit from 'p-limit';
import pthrottle from 'p-throttle';
import React from 'react';
import {
  Location, LocationBox, boundingBox, Database, dbFetch, dbUpdate, get, getJsonResponse, getLatLong,
} from '../utilities';

/**
  For each property, attempts to fetch the Zillow rental estimate.

  @param newProperties - The list of properties for which we wish to get a rental estimate.

  @returns: An Database with the rental information for the properties.
*/
async function fetchRentalZestimates(newProperties: Array<Property>): Promise<Database> {
  const limit = plimit(20);
  const apiName = 'GetDeepSearchResults';
  const zillowUrl = `${zillowApiBaseUrl}/${apiName}.htm?zws-id=${ZILLOW_API_KEY}`;
  const requests = newProperties.map((property) => {
    if (!property.address || !property.zipCode) {
      return null;
    }
    const url = `${zillowUrl}&address=${encodeURIComponent(property.address)}&citystatezip=${property.zipCode}&rentzestimate=true`;
    return limit(() => getJsonResponse(url, 'xml', true));
  }).filter((request: Promise<any> | null) => request);
  const zillowData = await Promise.all(requests);
  const newDB: Database = {};
  zillowData.forEach((results) => {
    if (!Array.isArray(results)) {
      return;
    }
    const found = results.filter(
      (item) => get(item, 'rentzestimate.0.amount.0._'),
    );
    if (found.length == 0) {
      return;
    }
    newDB[Number(get(found[0], 'zpid.0'))] = {
      rentzestimate: Number(get(found[0], 'rentzestimate.0.amount.0._')),
      zestimate: Number(get(found[0], 'zestimate.0.amount.0._')),
    };
  });
  return newDB;
}


/**
  Calculates the median known rental values in the given area using the rent bits API.

  @param box - The bounding box in which to search for property estimates.

  @returns: The estimated price or null if not possible to estimate.
*/
async function getRentBitsEstimate({lat, lng}: Location): Promise<number | null> {
  const box = boundingBox(lat, lng, 5);
  const url = `${rentBitsApiBaseUrl}?bounds=${box.south},${box.north},${box.west},${box.east}`;
  const res = await getJsonResponse(url, 'json', true);
  const results = get(res, 'data') as (Array<{price?: string}> | null)
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
  const sorted = [...prices].sort((a,b) => a - b);
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
  const rents: {[key: number]: number} = {};
  const throttled = pthrottle(getRentBitsEstimate, 5, 1000);
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
    const zillowEstimates = await fetchRentalZestimates(newProperties);
    const remainingProperties = newProperties.filter((item: Property) => {
      return !(item.zpid && item.zpid in zillowEstimates);
    });
    const rentBitsEstimates = await fetchRentalBitsEstimates(remainingProperties);
    rentalDB = { ...rentalDB, ...zillowEstimates, ...rentBitsEstimates };
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
};
interface PropertyListingsProps {};

const DefaultState: PropertyListingsState = {
  filter: DefaultFilter,
  filteredListings: [],
  propertyListings: [],
  updateFilter: (filter: FilterState) => { return; },
};

const PropertyListingsContext = React.createContext(DefaultState);

export class PropertyListingsProvider extends React.Component<PropertyListingsProps, PropertyListingsState> {
  constructor(props: PropertyListingsProps) {
    super(props);
    this.applyFilter = debounce(this.applyFilter, 500);

    this.state = {...DefaultState, updateFilter: this.updateFilter}
  }

  updateFilter = (filter: FilterState): void => {
    // This execution is debounced.
    this.applyFilter(filter);
  }

  /**
    Applies the provided filter to the component.

    @param filter - The filter provided by the user.
  */
  async applyFilter(filter: FilterState): Promise<void> {
    const prevGeoLocation = this.state.filter.geoLocation;
    const prevRadius = this.state.filter.radius;
    const {
      geoLocation,
      includeLand,
      meetsRule,
      priceFrom,
      radius,
      rentOnly,
      sortOrder,
    } = filter;
    let { propertyListings } = this.state;
    // New location so we need to fetch new property listings.
    if (prevGeoLocation !== geoLocation || prevRadius != radius) {
      // Loading!
      this.setState({ filter: {...filter, loading: true}});
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

    this.setState({
      filter: {...filter, loading: false},
      propertyListings,
      filteredListings,
    });
  }

  render() {
    const { children } = this.props;
    const { propertyListings, filteredListings, filter } = this.state;
    return (
      <PropertyListingsContext.Provider
        value={{
          ...this.state,
          filteredListings: filteredListings,
          updateFilter: this.updateFilter,
        }}
      >
        {children}
      </PropertyListingsContext.Provider>
    );
  }
}

export const PropertyListingsConsumer = PropertyListingsContext.Consumer;
