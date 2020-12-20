import React from 'react';
import { RouteComponentProps } from '@reach/router';

import { Filter } from '../components/Filter';
import { Hero } from '../components/Hero';
import { Listing } from '../components/Listing';

import {
  PropertyListingsProvider,
  PropertyListingsConsumer,
} from '../context/PropertyListingsProvider';

function Home(props: RouteComponentProps): React.ReactElement {
  return (
    <>
      <Hero />
      <div className="container">
        <PropertyListingsProvider>
          <PropertyListingsConsumer>
            {({ filter, filteredListings, updateFilter }) => (
              <>
                <Filter
                  updateFilter={updateFilter}
                />
                <h3> 
                  {!filter.loading
                    ? `Num Results: ${filteredListings.length}`
                    : "Loading results..."
                  }
                </h3>
                <div className="columns">
                  {filteredListings.map((property, idx) => (
                    <Listing property={property} key={idx} />
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

export { Home };
