import classnames from 'classnames';
import React from 'react';
import { Property } from '../common';

type ListingProps = {
  property: Property,
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function openInNewTab(href: string): void {
  Object.assign(document.createElement('a'), {
    target: '_blank',
    rel: 'noopener noreferrer',
    href,
  }).click();
}

export default function Listing({ property }: ListingProps): React.ReactElement {
  const {
    address,
    baths,
    beds,
    city,
    detailUrl,
    imgSrc,
    livingArea,
    price,
    rentzestimate,
    state,
    lastSold,
    statusType,
    zestimate,
  } = property;
  const columnClasses = classnames('column', 'col-4', 'col-xs-12', 'mb-5');
  const cardClasses = classnames('card');
  return (
    <div className={columnClasses} style={{ margin: '1rem 0' }}>
      <div
        className={cardClasses}
        onClick={() => openInNewTab(`http://www.zillow.com${detailUrl}`)}
        onKeyPress={() => openInNewTab(`http://www.zillow.com${detailUrl}`)}
        role="link"
        tabIndex={0}
        style={{ cursor: 'pointer' }}
      >
        <div className="card-image">
          <img className="img-responsive" src={imgSrc} alt={`${address}, ${city || 'Unknown'} ${state || 'NA'}`} />
        </div>
        <div className="card-header">
          <div className="card-title h5">
            {(statusType === 'SOLD' && lastSold) ? `[${lastSold}] ${address}` : address}
            ,
            {' '}
            {city || 'Unknown'}
            {' '}
            {state || 'NA'}
          </div>
          <div className="card-title h6">
            {(price && statusType !== 'SOLD') ? `Price: ${currencyFormatter.format(price)}` : ''}
            {(price && statusType === 'SOLD') ? `Sold For: ${currencyFormatter.format(price)}` : ''}
            {(!price && statusType === 'SOLD') ? 'Unknown Sale Price' : ''}
            {(zestimate) ? ` (est. ${currencyFormatter.format(zestimate)})` : ''}
          </div>
          <div className="card-subtitle text-gray">
            Rent Estimate:
            {(rentzestimate) ? ` ${currencyFormatter.format(rentzestimate)}` : ' N/A'}
            {(livingArea && price) ? `, ${currencyFormatter.format(price / livingArea)}/ft` : ''}
          </div>
        </div>
        <div className="card-body">
          Beds:
          {' '}
          {beds || 'N/A'}
          , Baths:
          {' '}
          {baths || 'N/A'}
          <br />
          Living Area:
          {' '}
          { livingArea || 'N/A'}
          sqft
          <br />
          {(rentzestimate && price) ? `R/P: ${((100 * rentzestimate) / price).toFixed(2)}%` : ''}
          <br />
          {(rentzestimate && zestimate) ? `R/P (est.): ${((100 * rentzestimate) / zestimate).toFixed(2)}%` : ''}
        </div>
      </div>
    </div>
  );
}
