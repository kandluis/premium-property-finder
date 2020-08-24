// URL for API used when translating an address or location to lat/long coordinates.
const geocodingBaseUrl = "https://www.mapquestapi.com/geocoding/v1/address";
// URL for public Zillow API.
const zillowBaseUrl = 'https://www.zillow.com/search/GetSearchPageState.htm';
const zillowApiBaseUrl = 'https://www.zillow.com/webservice';
const proxyUrl = 'https://cors-anywhere.herokuapp.com';
const dbEndpoint = 'https://property-server.herokuapp.com/api';

const MAPQUEST_API_KEY = process.env.REACT_APP_MAPQUEST_API_KEY;
const ZILLOW_API_KEY = process.env.REACT_APP_ZILLOW_API_KEY;
const DB_SECRET = process.env.REACT_APP_SECRET;

export {
  geocodingBaseUrl,
  zillowBaseUrl,
  zillowApiBaseUrl,
  proxyUrl,
  dbEndpoint,
  MAPQUEST_API_KEY,
  ZILLOW_API_KEY,
  DB_SECRET,
};