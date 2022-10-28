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
  homeType?: string,
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
  meetsRule: [number, number];
  rentOnly: boolean;
  newConstruction: boolean;
  includeLand: boolean;
  homeTypes: string[] | null;
  sortOrder: SortOrder;

  readonly sortOrders: readonly SortOrder[];
}
const DefaultLocalSettings: LocalFilterSettings = {
  meetsRule: [0, 2],
  rentOnly: false,
  newConstruction: false,
  includeLand: false,
  sortOrder: 'Shortest Commute',
  sortOrders,
  homeTypes: null,
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

const PropAccessors = {
  getPrice: (prop: Property) => prop.price || prop.zestimate || Infinity,
  getRentToPrice: (prop: Property) => 100 * (
    (prop.rentzestimate || 0) / PropAccessors.getPrice(prop)),
  getZestimateToPrice: (prop: Property) => 100 * (
    (prop.zestimate || prop.price) / PropAccessors.getPrice(prop)),
  getPricePerSqft: (prop: Property) => (prop.price || prop.zestimate || 0) / (prop.livingArea || 1),
  getCommute: (prop: Property) => (prop.travelTime || Infinity) / 60,
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
        const aPrice = PropAccessors.getPrice(a);
        const bPrice = PropAccessors.getPrice(b);
        return aPrice - bPrice;
      };
    case 'Descending Price':
      return (a: Property, b: Property) => {
        const aPrice = PropAccessors.getPrice(a);
        const bPrice = PropAccessors.getPrice(b);
        return bPrice - aPrice;
      };
    case 'Ascending Rent/Price Ratio':
      return (a: Property, b: Property) => {
        const aRatio = PropAccessors.getRentToPrice(a);
        const bRatio = PropAccessors.getRentToPrice(b);
        return aRatio - bRatio;
      };
    case 'Descending Rent/Price Ratio':
      return (a: Property, b: Property) => {
        const aRatio = PropAccessors.getRentToPrice(a);
        const bRatio = PropAccessors.getRentToPrice(b);
        return bRatio - aRatio;
      };
    case 'Ascending Zestimate/Price Ratio':
      return (a: Property, b: Property) => {
        const aRatio = PropAccessors.getZestimateToPrice(a);
        const bRatio = PropAccessors.getZestimateToPrice(b);
        return aRatio - bRatio;
      };
    case 'Descending Zestimate/Price Ratio':
      return (a: Property, b: Property) => {
        const aRatio = PropAccessors.getZestimateToPrice(a);
        const bRatio = PropAccessors.getZestimateToPrice(b);
        return bRatio - aRatio;
      };
    case 'Ascending Price/SqFt':
      return (a: Property, b: Property) => {
        const aRatio = PropAccessors.getPricePerSqft(a);
        const bRatio = PropAccessors.getPricePerSqft(b);
        return aRatio - bRatio;
      };
    case 'Descending Price/SqFt':
      return (a: Property, b: Property) => {
        const aRatio = PropAccessors.getPricePerSqft(a);
        const bRatio = PropAccessors.getPricePerSqft(b);
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
  LocalFilterSettings,
  notEmpty,
  FetchPropertiesRequest,
  FilterState,
  PlaceInfo,
  PropAccessors,
  Property,
  sortFn,
  SortOrder,
};
