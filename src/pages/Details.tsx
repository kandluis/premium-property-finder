import React from 'react';
import { RouteComponentProps } from '@reach/router';

import { Map } from '../components/map';
import { KeyFeatures } from '../components/keyFeatures';

type DetailsProps = {
  propertyId: number
};

function Details({ propertyId }: RouteComponentProps<DetailsProps>): React.ReactElement {
  const features = [
    'Help to Buy available, ideal for first time buyers',
    'Within walking distance of the Northern Quarter, Ancoats & NOMA',
    'Exposed brickwork retaining the charm of the existing building',
    'Cycle storage',
    'Victorian Mill conversion',
    '13 unique 1,2 and 3 bed apartments available'
  ]
  return (
    <div>
      Show details for property with Id of {propertyId || 'N/A'} 
      <KeyFeatures features={features} />
      <Map />
    </div>
  )
}

export { Details };