interface FilterState {
  geoLocation: string,
  meetsRule: number | null,
  priceFrom: number | null,
  radius: number | null,
  rentOnly: boolean,
  sortOrder: string,

  readonly sortOrders: Array<string>,
}

const DefaultFilter: FilterState = {
  geoLocation: '',
  meetsRule: null,
  priceFrom: null,
  radius: null,
  rentOnly: false,
  sortOrder: '',
  sortOrders: ['Highest First', 'Lowest First'],
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
