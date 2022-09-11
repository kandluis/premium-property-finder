type SortOrder = 'ascendingprice' | 'descendingprice' | 'ascendingratio' | 'descendingratio';
type HomeType = 'ALL' | 'SINGLE_FAMILY' | 'LOT' | 'MANUFACTURED' | 'TOWNHOUSE' | 'MULTI_FAMILY';

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
  priceMost: 250000,
};

interface LocalFilterSettings {
  meetsRule: number | null;
  rentOnly: boolean;
  newConstruction: boolean;
  includeLand: boolean;
  homeType: HomeType;
  sortOrder: SortOrder;

  readonly sortOrders: [string, string, string, string];
  readonly homeTypes: [string, string, string, string, string, string];
}
const DefaultLocalSettings: LocalFilterSettings = {
  meetsRule: null,
  rentOnly: false,
  newConstruction: false,
  includeLand: true,
  sortOrder: 'descendingratio',
  sortOrders: ['Ascending Price', 'Descending Price', 'Ascending Ratio', 'Descending Ratio'],
  homeType: 'ALL',
  homeTypes: ['All', 'Single Family', 'Lot', 'Manufactured', 'Townhouse', 'Multi Family'],
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
    case 'ascendingprice':
      return (a: Property, b: Property) => {
        const aPrice = a.price || 0;
        const bPrice = b.price || 0;
        return aPrice - bPrice;
      };
    case 'descendingprice':
      return (a: Property, b: Property) => {
        const aPrice = a.price || 0;
        const bPrice = b.price || 0;
        return bPrice - aPrice;
      };
    case 'ascendingratio':
      return (a: Property, b: Property) => {
        const aRatio = (a.rentzestimate || 0) / (a.price || 1);
        const bRatio = (b.rentzestimate || 0) / (b.price || 1);
        return aRatio - bRatio;
      };
    case 'descendingratio':
      return (a: Property, b: Property) => {
        const aRatio = (a.rentzestimate || 0) / (a.price || 1);
        const bRatio = (b.rentzestimate || 0) / (b.price || 1);
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
