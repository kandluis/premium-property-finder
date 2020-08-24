// URL for API used when translating an address or location to lat/long coordinates.
export const geocodingBaseUrl = 'https://www.mapquestapi.com/geocoding/v1/address';
// URL for public Zillow API.
export const zillowBaseUrl = 'https://www.zillow.com/search/GetSearchPageState.htm';
export const zillowApiBaseUrl = 'https://www.zillow.com/webservice';
export const proxyUrl = 'https://cors-anywhere.herokuapp.com';
export const dbEndpoint = 'https://property-server.herokuapp.com/api';

export const MAPQUEST_API_KEY: string = process.env.REACT_APP_MAPQUEST_API_KEY || '';
export const ZILLOW_API_KEY: string = process.env.REACT_APP_ZILLOW_API_KEY || '';
export const DB_SECRET: string = process.env.REACT_APP_SECRET || '';

export const defaultRadiusSearch = 8;