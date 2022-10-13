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
              loading, percent, filteredProperties, allProperties, remoteUpdate, localUpdate,
            }) => (
              <>
                <Filter
                  localUpdate={localUpdate}
                  remoteUpdate={remoteUpdate}
                  results={filteredProperties}
                  all={allProperties}
                />
                {!loading
                  ? (
                    <h3>
                      Results:
                      {' '}
                      {`${filteredProperties.length} of ${allProperties.length}`}
                    </h3>
                  )
                  : <ProgressBar percent={percent} />}
                <div className="columns">
                  {filteredProperties.map((property) => (
                    <Listing property={property} key={`${property.zpid || ''}-${property.statusType}`} />
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
