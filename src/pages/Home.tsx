import React from 'react';

import Filter from '../components/Filter';
import Hero from '../components/Hero';
import Listing from '../components/Listing';
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
              loading, filteredProperties, remoteUpdate, localUpdate,
            }) => (
              <>
                <Filter
                  localUpdate={localUpdate}
                  remoteUpdate={remoteUpdate}
                />
                <h3>
                  {!loading
                    ? `Num Results: ${filteredProperties.length}`
                    : 'Loading results...'}
                </h3>
                <div className="columns">
                  {filteredProperties.map((property) => (
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
