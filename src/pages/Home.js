import * as React from 'react';

import { Filter } from "../components/Filter"
import { Hero } from '../components/Hero';
import { Listing } from '../components/listing'


import {
  PropertyListingsProvider,
  PropertyListingsConsumer
} from '../context/PropertyListingsProvider';

function Home() {
  return (
    <React.Fragment>
    <Hero />
    <div className='container'>
      <PropertyListingsProvider>
        <PropertyListingsConsumer>
          {({ propertyListings, allListings, updateFilter, numResults }) => (
            <React.Fragment>
              <Filter
                updateFilter={updateFilter}
              />
              <h3>Num Results: {numResults}</h3>
              <div className='columns'>
                {propertyListings.map(listing => (
                  <Listing listing={listing} key={listing.zpid} />
                ))}
              </div>
            </React.Fragment>
          )}
        </PropertyListingsConsumer>
      </PropertyListingsProvider>
    </div>
    </React.Fragment>
  );
}

export { Home };