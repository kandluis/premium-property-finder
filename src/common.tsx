const dimensions = [
  'Price',
  'Rent/Price Ratio',
  'Zestimate/Price Ratio',
  'Price/SqFt',
  'Commute',
] as const;
type Dimension = typeof dimensions[number];
type SortOrder = {
  ascending: boolean;
  dimension: Dimension;
  // Higher priority sorts apply only within equal values of lower priority sorts.
  priority?: number;
};
const sortOrders = dimensions.map(
  (dimension) => ({ dimension, ascending: true }),
).concat(dimensions.map(
  (dimension) => ({ dimension, ascending: false }),
));

type PlaceInfo = {
  placeId: string;
  description: string;
  prediction?: google.maps.places.AutocompletePrediction;
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
  description: '',
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
  sortOrder: SortOrder[];

  readonly sortOrders: readonly SortOrder[];
}
const DefaultLocalSettings: LocalFilterSettings = {
  meetsRule: [0, 2],
  rentOnly: false,
  newConstruction: false,
  includeLand: false,
  sortOrder: [{
    ascending: true,
    dimension: 'Commute',
    priority: 0,
  }],
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
function sortFn({ ascending, dimension }: SortOrder): (_1: Property, _2: Property) => number {
  const multiplier = (ascending) ? 1 : -1;
  switch (dimension) {
    case 'Price':
      return (a: Property, b: Property) => {
        const aPrice = PropAccessors.getPrice(a);
        const bPrice = PropAccessors.getPrice(b);
        return multiplier * (aPrice - bPrice);
      };
    case 'Rent/Price Ratio':
      return (a: Property, b: Property) => {
        const aRatio = PropAccessors.getRentToPrice(a);
        const bRatio = PropAccessors.getRentToPrice(b);
        return multiplier * (aRatio - bRatio);
      };
    case 'Zestimate/Price Ratio':
      return (a: Property, b: Property) => {
        const aRatio = PropAccessors.getZestimateToPrice(a);
        const bRatio = PropAccessors.getZestimateToPrice(b);
        return multiplier * (aRatio - bRatio);
      };
    case 'Price/SqFt':
      return (a: Property, b: Property) => {
        const aRatio = PropAccessors.getPricePerSqft(a);
        const bRatio = PropAccessors.getPricePerSqft(b);
        return multiplier * (aRatio - bRatio);
      };
    case 'Commute':
      return (a: Property, b: Property) => {
        if (a.travelTime && b.travelTime) {
          return multiplier * (a.travelTime - b.travelTime);
        }
        if (!a.travelTime && b.travelTime) {
          return multiplier * (b.travelTime);
        }
        if (a.travelTime && !b.travelTime) {
          return multiplier * (-a.travelTime);
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

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumSignificantDigits: 4,
});

export {
  DefaultFetchPropertiesRequest,
  DefaultFilter,
  DefaultLocalSettings,
  currencyFormatter,
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
