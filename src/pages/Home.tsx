import React from 'react';

import Filter from '../components/Filter';
import Hero from '../components/Hero';
import Listing from '../components/Listing';
import ProgressBar from '../components/ProgressBar';
import ResultSummary from '../components/ResultSummary';
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
                  loading={loading}
                />
                {!loading
                  ? <ResultSummary all={allProperties} filtered={filteredProperties} />
                  : <ProgressBar value={100 * percent} />}
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
