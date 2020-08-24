import accounting from 'accounting';
import { DefaultFilter, FilterState, Property } from '../common';
import {
  defaultRadiusSearch, geocodingBaseUrl, MAPQUEST_API_KEY, zillowApiBaseUrl, zillowBaseUrl, ZILLOW_API_KEY,
} from '../constants';
import debounce from 'lodash.debounce';
import plimit from 'p-limit';
import React from 'react';
import {
  boundingBox, Database, dbFetch, dbUpdate, get, getJsonResponse,
} from '../utilities';

/**
  Attaches the Zillow zestimate for rent to each propertiy.

  @param properties - The list of properties to which we attach a rental estimate.

  @returns: An array of properties with attached rental estimates.
*/
async function attachRentestimates(properties: Array<Property>): Promise<Array<Property>> {
  let ZillowDB = await dbFetch();
  const newProperties = properties.filter((item) => {
    return !(item.zpid && item.zpid in ZillowDB)
  });
  if (newProperties.length > 0) {
    // Limit concurrency to 20 requests at a time.
    const limit = plimit(20);
    const apiName = 'GetDeepSearchResults';
    const zillowUrl = `${zillowApiBaseUrl}/${apiName}.htm?zws-id=${ZILLOW_API_KEY}`;
    const requests = newProperties.map((property) => {
      if (!property.price || property.price > 315000 || !property.address || !property.zipCode) {
        return null;
      }
      const url = `${zillowUrl}&address=${encodeURIComponent(property.address)}&citystatezip=${property.zipCode}&rentzestimate=true`;
      return limit(() => getJsonResponse(url, 'xml', true));
    });
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
    ZillowDB = { ...ZillowDB, ...newDB };
    dbUpdate(ZillowDB);
  }
  properties = properties.map((property) => {
    if (!property.zpid) {
      return property;
    }
    return { ...property, ...ZillowDB[property.zpid] as Property }
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
  const geoCodeUrl = `${geocodingBaseUrl}?key=${MAPQUEST_API_KEY}&location=${location.toLowerCase()}`;
  const latLongData = await getJsonResponse(geoCodeUrl);
  const statusCode = get(latLongData, 'info.statuscode') as number;
  if (statusCode !== 0) {
    console.log(`Failed to retrieve lat/long data from ${location}. Status code: ${statusCode}`);
    return [];
  }
  const primaryResult = get(latLongData, 'results.0.locations.0') as {latLng: {lat: number, lng: number}} | null;
  if (primaryResult === null) {
    console.log(`Successful response with empty locations for location: ${location}`);
    return [];
  }
  const { lat, lng } = primaryResult.latLng;
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
  updateFilter: (filter: FilterState):void,
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
      geoLocation, priceFrom, sortOrder, radius, meetsRule, rentOnly,
    } = filter;
    let { propertyListings } = this.state;
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
    if (sortOrder) {
      filteredListings = propertyListings.sort((a, b) => {
        const aPrice = a.price || 0;
        const bPrice = b.price || 0;
        return ((sortOrder == 'lowestfirst') ? 1 : -1) * (aPrice - bPrice)
      });
    }

    this.setState({
      filter,
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
