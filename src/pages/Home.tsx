import React, { useState } from 'react';
import {
  Grow,
  Paper,
  Skeleton,
} from '@mui/material';
import Grid2 from '@mui/material/Unstable_Grid2';

import Filter from '../components/Filter';
import Hero from '../components/Hero';
import Listing from '../components/Listing';
import ProgressBar from '../components/ProgressBar';
import PropertyTable from '../components/PropertyTable';
import ResultSummary from '../components/ResultSummary';
import {
  PropertyListingsProvider,
  PropertyListingsConsumer,
} from '../context/PropertyListingsProvider';

export default function Home(): React.ReactElement {
  const [showAnalytics, setShowAnalytics] = useState(false);
  return (
    <Grid2 container spacing={2}>
      <Grid2 xs={12}>
        <Hero />
      </Grid2>
      <PropertyListingsProvider>
        <PropertyListingsConsumer>
          {({
            loading,
            percent,
            filteredProperties,
            allProperties,
            remoteUpdate,
            localUpdate,
            displayType,
            setDisplayType,
          }) => (
            <Grid2 xs={12}>
              <Grid2 id="filter" xs={12}>
                <Filter
                  localUpdate={localUpdate}
                  remoteUpdate={remoteUpdate}
                  results={filteredProperties}
                  all={allProperties}
                  loading={loading}
                  displayType={displayType}
                  setDisplayType={setDisplayType}
                />
              </Grid2>
              {loading
                ? (
                  <>
                    <Grid2 id="progress" xs={12}>
                      <ProgressBar value={100 * percent} />
                    </Grid2>
                    <Grid2
                      id="placeholders"
                      container
                      spacing={{ xs: 2, md: 3 }}
                      columns={{ xs: 4, sm: 8, md: 12 }}
                    >
                      {[...Array(3).keys()].map((key: number) => (
                        <Grid2 key={key} xs={4}>
                          <Skeleton variant="rounded" height={400} />
                        </Grid2>
                      ))}
                    </Grid2>
                  </>
                )
                : (
                  <Grid2 xs={12}>
                    <ResultSummary
                      all={allProperties}
                      filtered={filteredProperties}
                      showAnalytics={showAnalytics}
                      setShowAnalytics={setShowAnalytics}
                    />
                    <Paper elevation={2}>
                      <Grid2
                        container
                        spacing={{ xs: 2, md: 3 }}
                        columns={{ xs: 4, sm: 8, md: 12 }}
                      >
                        {(displayType === 'Grid')
                          ? filteredProperties.map((property) => (
                            <Grow key={`${property.detailUrl}-${property.statusType}`} in={!loading}>
                              <Grid2 xs={4}>
                                <Listing property={property} />
                              </Grid2>
                            </Grow>
                          ))
                          : <PropertyTable properties={filteredProperties} />}
                      </Grid2>
                    </Paper>
                  </Grid2>
                )}
            </Grid2>
          )}
        </PropertyListingsConsumer>
      </PropertyListingsProvider>
    </Grid2>
  );
}
