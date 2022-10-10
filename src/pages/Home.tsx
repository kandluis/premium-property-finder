import React from 'react';

import Filter from '../components/Filter';
import Hero from '../components/Hero';
import Listing from '../components/Listing';
import ProgressBar from '../components/ProgressBar';
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
              loading, percent, filteredProperties, remoteUpdate, localUpdate,
            }) => (
              <>
                <Filter
                  localUpdate={localUpdate}
                  remoteUpdate={remoteUpdate}
                />
                {!loading
                  ? (
                    <h3>
                      Num Results:
                      {' '}
                      {filteredProperties.length}
                    </h3>
                  )
                  : <ProgressBar width={400} percent={percent} />}
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
