// URL for API used when translating an address or location to lat/long coordinates.
export const geocodingBaseUrl = 'https://www.mapquestapi.com/geocoding/v1/address';
// URL for public Zillow API.
export const zillowBaseUrl = 'https://www.zillow.com/search/GetSearchPageState.htm';
export const zillowApiBaseUrl = 'https://www.zillow.com/webservice';
// URL used for Rent Bits rental estimates.proxyUrl
export const rentBitsApiBaseUrl = 'https://service.rentbits.com/api/v1/search';
export const proxyUrl = 'http://localhost:50822/proxy';
export const dbEndpoint = 'http://localhost:50822/api';
export const urlShortnerEndpoint = 'https://cutt.ly/api/api.php';

export const MAPQUEST_API_KEY: string = process.env.REACT_APP_MAPQUEST_API_KEY || '';
export const ZILLOW_API_KEY: string = process.env.REACT_APP_ZILLOW_API_KEY || '';
export const DB_SECRET: string = process.env.REACT_APP_SECRET || '';
export const CUTTLY_API_KEY: string = process.env.REACT_APP_CUTTLY || '';

export const defaultRadiusSearch = 8;
