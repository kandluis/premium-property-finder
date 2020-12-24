type SortOrder = 'ascendingprice' | 'descendingprice' | 'ascendingratio' | 'descendingratio' | '';


/**
  Constructs a sorting function to sort by the specified order.

  @param order - The ordering type to sort by.

  @returns - The sorting function.
*/
function sortFn(order: SortOrder): (a: Property, b: Property) => number {
  switch (order) {
    case "ascendingprice":
      return (a: Property, b: Property) => {
        const aPrice = a.price || 0;
        const bPrice = b.price || 0;
        return aPrice - bPrice;
      };
    case "descendingprice":
      return (a: Property, b: Property) => {
        const aPrice = a.price || 0;
        const bPrice = b.price || 0;
        return bPrice - aPrice;
      }
    case "ascendingratio":
      return (a: Property, b: Property) => {
        const aRatio = (a.rentzestimate || 0) / (a.price || 1);
        const bRatio = (b.rentzestimate || 0) / (b.price || 1);
        return aRatio - bRatio;
      }
    case "descendingratio":
      return (a: Property, b: Property) => {
        const aRatio = (a.rentzestimate || 0) / (a.price || 1);
        const bRatio = (b.rentzestimate || 0) / (b.price || 1);
        return bRatio - aRatio;
      }
    default:
      return (a:Property, b: Property) => { return 0 };
  }
}

interface FilterState {
  geoLocation: string,
  meetsRule: number | null,
  priceFrom: number | null,
  radius: number | null,
  rentOnly: boolean,
  includeLand: boolean,
  sortOrder: SortOrder,

  readonly sortOrders: Array<string>,
}

const DefaultFilter: FilterState = {
  geoLocation: '',
  meetsRule: null,
  priceFrom: null,
  radius: null,
  rentOnly: false,
  includeLand: false,
  sortOrder: '',
  sortOrders: ['Ascending Price', 'Descending Price', 'Ascending Ratio', 'Descending Ratio'],
};

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
}

export {
  DefaultFilter,
  FilterState,
  Property,
  sortFn,
  SortOrder,
};
