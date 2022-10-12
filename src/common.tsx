const sortOrders = [
  'Ascending Price',
  'Descending Price',

  'Ascending Rent/Price Ratio',
  'Descending Rent/Price Ratio',

  'Ascending Zestimate/Price Ratio',
  'Descending Zestimate/Price Ratio',

  'Ascending Price/SqFt',
  'Descending Price/SqFt',

  'Shortest Commute',
] as const;
type SortOrder = typeof sortOrders[number];

const homeTypes = [
  'All',
  'Single Family',
  'Lot',
  'Manufactured',
  'Townhouse',
  'Multi Family',
] as const;
type HomeType = typeof homeTypes[number];

type PlaceInfo = {
  placeId: string,
  name: string,
  address: string,
};

interface Property {
  address: string,
  detailUrl: string,
  imgSrc: string,
  price: number,
  statusType: string, // Usually we check just for 'SOLD'. Have seen 'FOR_SALE'.
  statusText: string,
  listingType: string, // Usually just 'NEW_CONSTRUCTION'

  area?: number,
  baths?: number,
  beds?: number,
  city?: string,
  homeType?: HomeType,
  lastSold?: string,
  livingArea?: number;
  lotArea?: number,
  rentzestimate?: number
  state?: string,
  travelTime?: number, // Travel time in minutes to commute location.
  zestimate?: number;
  zipCode?: number,
  zpid?: number,
}

interface FetchPropertiesRequest {
  geoLocation: PlaceInfo;
  commuteLocation: PlaceInfo;
  radius: number;
  priceFrom: number;
  priceMost: number;
  includeRecentlySold: boolean;
}

const DefaultPlaceInfo = {
  placeId: '',
  name: '',
  address: '',
};
const DefaultFetchPropertiesRequest: FetchPropertiesRequest = {
  geoLocation: DefaultPlaceInfo,
  commuteLocation: DefaultPlaceInfo,
  radius: 3.5,
  priceFrom: 0,
  priceMost: 1500000,
  includeRecentlySold: false,
};

interface LocalFilterSettings {
  meetsRule: number | null;
  rentOnly: boolean;
  newConstruction: boolean;
  includeLand: boolean;
  homeType: HomeType;
  sortOrder: SortOrder;

  readonly sortOrders: readonly SortOrder[];
  readonly homeTypes: readonly HomeType[];
}
const DefaultLocalSettings: LocalFilterSettings = {
  meetsRule: null,
  rentOnly: false,
  newConstruction: false,
  includeLand: false,
  sortOrder: 'Shortest Commute',
  sortOrders,
  homeType: 'All',
  homeTypes,
};

interface FilterState {
  // Changes to these options requires fetching new data.
  remote: FetchPropertiesRequest;
  // Changes here requires only local updates.
  local: LocalFilterSettings;
}

const DefaultFilter: FilterState = {
  remote: DefaultFetchPropertiesRequest,
  local: DefaultLocalSettings,
};

/**
  Constructs a sorting function to sort by the specified order.

  @param order - The ordering type to sort by.

  @returns - The sorting function.
*/
function sortFn(order: SortOrder): (_1: Property, _2: Property) => number {
  switch (order) {
    case 'Ascending Price':
      return (a: Property, b: Property) => {
        const aPrice = (a.price || a.zestimate || 0);
        const bPrice = (b.price || b.zestimate || 0);
        return aPrice - bPrice;
      };
    case 'Descending Price':
      return (a: Property, b: Property) => {
        const aPrice = (a.price || a.zestimate || 0);
        const bPrice = (b.price || b.zestimate || 0);
        return bPrice - aPrice;
      };
    case 'Ascending Rent/Price Ratio':
      return (a: Property, b: Property) => {
        const aRatio = (a.rentzestimate || 0) / (a.price || a.zestimate || 0);
        const bRatio = (b.rentzestimate || 0) / (b.price || b.zestimate || 0);
        return aRatio - bRatio;
      };
    case 'Descending Rent/Price Ratio':
      return (a: Property, b: Property) => {
        const aRatio = (a.rentzestimate || 0) / (a.price || a.zestimate || 0);
        const bRatio = (b.rentzestimate || 0) / (b.price || b.zestimate || 0);
        return bRatio - aRatio;
      };
    case 'Ascending Zestimate/Price Ratio':
      return (a: Property, b: Property) => {
        const aRatio = (a.zestimate || a.price) / (a.price);
        const bRatio = (b.zestimate || b.price) / (b.price);
        return aRatio - bRatio;
      };
    case 'Descending Zestimate/Price Ratio':
      return (a: Property, b: Property) => {
        const aRatio = (a.zestimate || a.price) / (a.price);
        const bRatio = (b.zestimate || b.price) / (b.price);
        return bRatio - aRatio;
      };
    case 'Ascending Price/SqFt':
      return (a: Property, b: Property) => {
        const aRatio = (a.price || a.zestimate || 0) / (a.livingArea || 1);
        const bRatio = (b.price || b.zestimate || 0) / (b.livingArea || 1);
        return aRatio - bRatio;
      };
    case 'Descending Price/SqFt':
      return (a: Property, b: Property) => {
        const aRatio = (a.price || a.zestimate || 0) / (a.livingArea || 1);
        const bRatio = (b.price || b.zestimate || 0) / (b.livingArea || 1);
        return bRatio - aRatio;
      };
    case 'Shortest Commute':
      return (a: Property, b: Property) => {
        if (a.travelTime && b.travelTime) {
          return a.travelTime - b.travelTime;
        }
        if (!a.travelTime && b.travelTime) {
          return b.travelTime;
        }
        if (a.travelTime && !b.travelTime) {
          return -a.travelTime;
        }
        return 0;
      };
    default:
      return (_1:Property, _2: Property) => 0;
  }
}

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}

export {
  DefaultFetchPropertiesRequest,
  DefaultFilter,
  DefaultLocalSettings,
  HomeType,
  LocalFilterSettings,
  notEmpty,
  FetchPropertiesRequest,
  FilterState,
  PlaceInfo,
  Property,
  sortFn,
  SortOrder,
};
