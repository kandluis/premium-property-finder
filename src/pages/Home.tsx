import React from 'react';

import { Filter } from '../components/Filter';
import { Hero } from '../components/Hero';
import { Listing } from '../components/Listing';
import {
  PropertyListingsProvider,
  PropertyListingsConsumer,
} from '../context/PropertyListingsProvider';

export default function Home(): React.ReactElement {
  return (
    <>
      <Hero />
      <div className="container">
        <PropertyListingsProvider>
          <PropertyListingsConsumer>
            {({
              loading, filter, filteredListings, updateFilter,
            }) => (
              <>
                <Filter
                  updateFilter={updateFilter}
                  filter={filter}
                />
                <h3>
                  {!loading
                    ? `Num Results: ${filteredListings.length}`
                    : 'Loading results...'}
                </h3>
                <div className="columns">
                  {filteredListings.map((property) => (
                    <Listing property={property} key={property.zpid} />
                  ))}
                </div>
              </>
            )}
          </PropertyListingsConsumer>
        </PropertyListingsProvider>
      </div>
    </>
  );
}
