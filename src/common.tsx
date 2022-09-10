type SortOrder = 'ascendingprice' | 'descendingprice' | 'ascendingratio' | 'descendingratio' | '';

interface Property {
  address?: string,
  area?: number,
  baths?: number,
  beds?: number,
  city?: string,
  detailUrl?: string,
  imgSrc?: string,
  lotArea?: string,
  price?: number,
  rentzestimate?: number
  state?: string,
  statusText?: string,
  zipCode?: number,
  zpid?: number,
  type?: string,
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
  sortOrders: ['Ascending Price', 'Descending Price', 'Ascending Ratio', 'Descending Ratio'],
};

interface LocalFilterSettings {
  meetsRule: number | null;
  rentOnly: boolean;
  newConstruction: boolean;
  includeLand: boolean;
  sortOrder: SortOrder;

  readonly sortOrders: Array<string>;
}
const DefaultLocalSettings: LocalFilterSettings = {
  meetsRule: null,
  rentOnly: false,
  newConstruction: false,
  includeLand: false,
  sortOrder: '', // TODO: can we apply a default?
  sortOrders: ['Ascending Price', 'Descending Price', 'Ascending Ratio', 'Descending Ratio'],
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
  LocalFilterSettings,
  FetchPropertiesRequest,
  FilterState,
  Property,
  sortFn,
  SortOrder,
};
