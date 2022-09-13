const sortOrders = [
  'Ascending Price',
  'Descending Price',

  'Ascending Rent/Price Ratio',
  'Descending Rent/Price Ratio',

  'Ascending Zestimate/Price Ratio',
  'Descending Zestimate/Price Ratio',

  'Ascending Price/SqFt',
  'Descending Price/SqFt',
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

interface Property {
  address: string,
  detailUrl: string,
  imgSrc: string,
  price: number,
  statusText: string,
  type: string,

  area?: number,
  baths?: number,
  beds?: number,
  city?: string,
  homeType?: HomeType,
  livingArea?: number;
  lotArea?: number,
  rentzestimate?: number
  state?: string,
  zestimate?: number;
  zipCode?: number,
  zpid?: number,
}

interface FetchPropertiesRequest {
  geoLocation: string;
  radius: number;
  priceFrom: number;
  priceMost: number;
}
const DefaultFetchPropertiesRequest: FetchPropertiesRequest = {
  geoLocation: '',
  radius: 8,
  priceFrom: 0,
  priceMost: 1500000,
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
  includeLand: true,
  sortOrder: 'Descending Rent/Price Ratio',
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
        const aPrice = a.price;
        const bPrice = b.price;
        return aPrice - bPrice;
      };
    case 'Descending Price':
      return (a: Property, b: Property) => {
        const aPrice = a.price;
        const bPrice = b.price;
        return bPrice - aPrice;
      };
    case 'Ascending Rent/Price Ratio':
      return (a: Property, b: Property) => {
        const aRatio = (a.rentzestimate || 0) / a.price;
        const bRatio = (b.rentzestimate || 0) / b.price;
        return aRatio - bRatio;
      };
    case 'Descending Rent/Price Ratio':
      return (a: Property, b: Property) => {
        const aRatio = (a.rentzestimate || 0) / a.price;
        const bRatio = (b.rentzestimate || 0) / b.price;
        return bRatio - aRatio;
      };
    case 'Ascending Zestimate/Price Ratio':
      return (a: Property, b: Property) => {
        const aRatio = (a.zestimate || 0) / a.price;
        const bRatio = (b.zestimate || 0) / b.price;
        return aRatio - bRatio;
      };
    case 'Descending Zestimate/Price Ratio':
      return (a: Property, b: Property) => {
        const aRatio = (a.zestimate || 0) / a.price;
        const bRatio = (b.zestimate || 0) / b.price;
        return bRatio - aRatio;
      };
    case 'Ascending Price/SqFt':
      return (a: Property, b: Property) => {
        const aRatio = a.price / (a.livingArea || 1);
        const bRatio = b.price / (b.livingArea || 1);
        return aRatio - bRatio;
      };
    case 'Descending Price/SqFt':
      return (a: Property, b: Property) => {
        const aRatio = a.price / (a.livingArea || 1);
        const bRatio = b.price / (b.livingArea || 1);
        return bRatio - aRatio;
      };
    default:
      return (_1:Property, _2: Property) => 0;
  }
}

export {
  DefaultFetchPropertiesRequest,
  DefaultFilter,
  DefaultLocalSettings,
  HomeType,
  LocalFilterSettings,
  FetchPropertiesRequest,
  FilterState,
  Property,
  sortFn,
  SortOrder,
};
