interface FilterState {
  geoLocation: string,
  meetsRule: number | null,
  priceFrom: number | null,
  radius: number | null,
  rentOnly: boolean,
  sortOrder: string,

  readonly sortOrders: Array<string>,

  // Used to indicate the filter data is still loading.
  loading: boolean,
}

const DefaultFilter: FilterState = {
  geoLocation: '',
  meetsRule: null,
  priceFrom: null,
  radius: null,
  rentOnly: false,
  sortOrder: '',
  sortOrders: ['Highest First', 'Lowest First'],
  loading: false,
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
};
