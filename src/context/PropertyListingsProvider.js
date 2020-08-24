import accounting from 'accounting';
import * as constants from '../constants';
import debounce from 'lodash.debounce';
import plimit from 'p-limit';
import * as React from 'react';
import * as utilities from '../utilities';
import xml2js from 'xml2js';

const DefaultState = {
  propertyListings: [],
  filteredListings: [],
  filter: {},
};

const PropertyListingsContext = React.createContext(DefaultState);

/*
  Attaches the Zillow zestimate for rent to each propertiy.
*/
async function attachRentestimates(properties) {
  let ZillowDB = await utilities.dbFetch();
  const newProperties = properties.filter((item) => !(item.zpid in ZillowDB));
  if (newProperties.length > 0) {
    // Limit concurrency to 20 requests at a time.
    const limit = plimit(20);
    const apiName = 'GetDeepSearchResults';
    const zillowUrl = `${constants.zillowApiBaseUrl}/${apiName}.htm?zws-id=${constants.ZILLOW_API_KEY}`
    const requests = newProperties.map((property) => {
      if (property.price > 315000) {
        return null;
      }
      const url = `${zillowUrl}&address=${encodeURIComponent(property.address)}&citystatezip=${property.zipCode}&rentzestimate=true`;
      return limit(() => getJsonResponse(url, 'xml', true));
    });
    const zillowData = await Promise.all(requests);
    const newDB = {};
    zillowData.forEach((results) => {
      if (!Array.isArray(results)) {
        return;
      }
      const found = results.filter(
        (item) =>  utilities.get(item, 'rentzestimate.0.amount.0._'));
      if (found.length == 0) {
        return;
      }
      newDB[Number(utilities.get(found, '0.zpid.0'))] = {
        'rentzestimate': Number(utilities.get(found, '0.rentzestimate.0.amount.0._')),
        'zestimate': Number(utilities.get(found, '0.zestimate.0.amount.0._')),
      };
    })
    ZillowDB = {...ZillowDB, ...newDB };
    utilities.dbUpdate(ZillowDB);
  }
  properties = properties.map((property) => {
    return {...property, ...ZillowDB[property.zpid] };
  });
  return properties;
}

/*
  Fetches the JSON reponse at the specified URL. 

  Results are cached in the session storage to avoid unnecessary
  load on APIs.
*/
async function getJsonResponse(url, format='json', useProxy=false) {
  if (useProxy) {
    url = `${constants.proxyUrl}/${url}`;
  }
  const storageKey = `getJsonReponse(${url})`;
  const data = sessionStorage.getItem(storageKey);
  if (data != null) {
    return JSON.parse(data);
  }  
  const blob = await fetch(url);
  let parsedData = null;
  if (format == 'json') {
    parsedData = await blob.json();
  } else if (format == 'xml') {
    const parsedText = await blob.text();
    parsedData = await xml2js.parseStringPromise(parsedText);
    parsedData = utilities.get(parsedData,
      'SearchResults:searchresults.response.0.results.0.result')
  }
  sessionStorage.setItem(storageKey, JSON.stringify(parsedData));
  return parsedData;
}

async function fetchProperties(location, radius) {
  const geoCodeUrl = `${constants.geocodingBaseUrl}?key=${constants.MAPQUEST_API_KEY}&location=${location.toLowerCase()}`
  const latLongData = await getJsonResponse(geoCodeUrl);
  const statusCode = utilities.get(latLongData, 'info.statuscode');
  if (statusCode !== 0) {
    console.log(`Failed to retrieve lat/long data from ${location}. Status code: ${statusCode}`);
    return [];
  }
  const primaryResult = utilities.get(latLongData, 'results.0.locations.0');
  if (primaryResult === null) {
    console.log(`Successful response with empty locations for location: ${location}`);
    return [];
  }
  const {lat, lng} = primaryResult.latLng;
  const wants = {
    cat1: ["mapResults"]
  };
  const searchQueryState = {
    mapBounds: utilities.boundingBox(lat, lng, radius * 2)
  };
  const zillowUrl = `${constants.zillowBaseUrl}?searchQueryState=${JSON.stringify(searchQueryState)}&wants=${JSON.stringify(wants)}`;
  const data = await getJsonResponse(`${zillowUrl}`, 'json', true);
  var propertyListings = utilities.get(data, 'cat1.searchResults.mapResults');
  propertyListings = propertyListings.map((item) => parseResult(item));
  propertyListings = propertyListings.filter((item) => {
    return ('zpid' in item 
            && 'price' in item && item.price > 0)
  });
  return propertyListings;
};

function parseResult(item) {
  if (item.zpid) {
    item.zpid = Number(item.zpid);
  }
  if (item.price) {
    item.price = accounting.unformat(item.price.replace('.','').replace(',',''));
  }
  if (item.area) {
    item.area = Number(item.area)
  }
  if (item.baths) {
    item.baths = Number(item.baths)
  }
  if (item.beds) {
    item.beds = Number(item.beds)
  }
  if (item.address && item.detailUrl) {
    // /something/address-seperated-by-city-state-zip.
    const addressComponents = item.detailUrl.split('/')[2].split('-');
    item.zipCode = Number(addressComponents[addressComponents.length - 1]);
    item.state =  addressComponents[addressComponents.length - 2];
    // This is not always valid. If a city is two words, we'll only get the
    // last one! :o
    item.city = addressComponents[addressComponents.length - 3];
    item.address = addressComponents.slice(0, addressComponents.length - 3).join(' ');
  }
  return item;
}

export class PropertyListingsProvider extends React.Component {
  state = DefaultState;
  
  constructor() {
    super();
    this.applyFilter = debounce(this.applyFilter, 500);
  }

  updateFilter = (filter) => {
    // This execution is debounced.
    this.applyFilter(filter);
  }

  async applyFilter(filter) {
    const prevGeoLocation = this.state.filter.geoLocation;
    const prevRadius = this.state.filter.radius;
    const { geoLocation, priceFrom, sortOrder, radius, meetsRule, rentOnly } = filter;
    var { propertyListings } = this.state;
    // New location so we need to fetch new property listings.
    if (prevGeoLocation !== geoLocation || prevRadius != radius) {
      const properties = await fetchProperties(geoLocation, (radius) ? radius : 8);
      const newListings = await attachRentestimates(properties);
      if (newListings) {
        propertyListings = newListings;
      }
    }
    let filteredListings = propertyListings;
    if (priceFrom) {
      filteredListings = propertyListings.filter(item => item.price >= priceFrom);
    }
    if (meetsRule) {
      filteredListings = filteredListings.filter(item => {
        if (!('rentzestimate' in item)) {
          return !rentOnly;
        }
        if (item.rentzestimate <= 0) {
          return !rentOnly;
        }
        const ratio = 100*item.rentzestimate / item.price;
        return ratio >= meetsRule;
      });
    }
    if (sortOrder) {
      filteredListings = propertyListings.sort((a,b) => {
        return ((sortOrder == 'lowestfirst') ? 1 : -1) * (a.price - b.price);
      });
    }

    this.setState({
      filter,
      propertyListings,
      filteredListings,
    })
  }

  render() {
    const { children } = this.props
    const { propertyListings, filteredListings, filter } = this.state
    return (
      <PropertyListingsContext.Provider
        value={{
          allListings: propertyListings,
          propertyListings: filteredListings,
          updateFilter: this.updateFilter,
          numResults: filteredListings.length,
        }}
      >
        {children}
      </PropertyListingsContext.Provider>
    )
  };
}

export const PropertyListingsConsumer = PropertyListingsContext.Consumer;