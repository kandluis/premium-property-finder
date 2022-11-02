import React from 'react';
import Grid2 from '@mui/material/Unstable_Grid2';

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
    <Grid2 container spacing={2}>
      <Grid2 xs={12}>
        <Hero />
      </Grid2>
      <Grid2 xs={12}>
        <PropertyListingsProvider>
          <PropertyListingsConsumer>
            {({
              loading, percent, filteredProperties, allProperties, remoteUpdate, localUpdate,
            }) => (
              <>
                <Grid2 xs={12}>
                  <Filter
                    localUpdate={localUpdate}
                    remoteUpdate={remoteUpdate}
                    results={filteredProperties}
                    all={allProperties}
                    loading={loading}
                  />
                </Grid2>
                <Grid2 xs={12}>
                  {!loading
                    ? <ResultSummary all={allProperties} filtered={filteredProperties} />
                    : <ProgressBar value={100 * percent} />}
                </Grid2>
                <div className="columns">
                  {filteredProperties.map((property) => (
                    <Listing property={property} key={`${property.zpid || ''}-${property.statusType}`} />
                  ))}
                </div>
              </>
            )}
          </PropertyListingsConsumer>
        </PropertyListingsProvider>
      </Grid2>
    </Grid2>
  );
}
