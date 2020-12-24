import classnames from 'classnames';
import React from 'react';
import { Property } from '../common';

type ListingProps = {
  property: Property,
}

function Listing({ property }: ListingProps): React.ReactElement {
  const {
    address,
    baths,
    beds,
    city,
    detailUrl,
    imgSrc,
    price,
    rentzestimate,
    state,
  } = property;
  const columnClasses = classnames('column', 'col-4', 'col-xs-12', 'mb-5');
  const cardClasses = classnames('card');
  return (
    <div className={columnClasses} style={{ margin: '1rem 0' }}>
      <div className={cardClasses}>
        <div className="card-image">
          <img className="img-responsive" src={imgSrc || ''} alt={(address) ? `${address}, ${city} ${state}` : ''} />
        </div>
        <div className="card-header">
          <div className="card-title h5">
            {address || 'None'}
            ,
            {' '}
            {city || 'Unknown'}
            {' '}
            {state || 'NA'}
          </div>
          <div className="card-title h6">
            Price: $
            {price || 'N/A'}
          </div>
          <div className="card-subtitle text-gray">
            Rent Estimate: $
            {rentzestimate || 'N/A'}
          </div>
        </div>
        <div className="card-body">
          Beds: {beds || 'N/A'}, Baths: {baths || 'N/A'} , Rent to Price: {(rentzestimate && price) ? (100 * rentzestimate / price).toFixed(2) : 'N/A'}
          %
        </div>
        <div className="card-footer">
          <a
            className="btn btn-primary"
            href={`http://www.zillow.com${detailUrl || ''}`}
            target="_blank"
            rel="noreferrer"
          >
            Go to property
          </a>
        </div>
      </div>
    </div>
  );
}

export { Listing };
