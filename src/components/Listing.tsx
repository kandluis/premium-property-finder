import classnames from 'classnames';
import React from 'react';
import { PropAccessors, Property } from '../common';

type ListingProps = {
  property: Property,
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumSignificantDigits: 4,
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
    lastSold,
    livingArea,
    price,
    rentzestimate,
    state,
    statusType,
    travelTime,
    zestimate,
  } = property;
  const title = (travelTime) ? `[${(PropAccessors.getCommute(property)).toFixed(1)} min] ${address}` : address;
  const imgAltText = `${title}, ${city || 'Unknown'} ${state || 'NA'}`;
  const finalImgSrc = (imgSrc.includes('maps.googleapis.com')) ? `https://via.placeholder.com/378x283?Text=${imgAltText}` : imgSrc;
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
          <img className="img-responsive" src={finalImgSrc} alt={imgAltText} />
        </div>
        <div className="card-header">
          <div className="card-title h5">
            {(statusType === 'SOLD' && lastSold) ? `[${lastSold}] ${title}` : title}
            ,
            {' '}
            {city || 'Unknown'}
            {' '}
            {state || 'NA'}
          </div>
          <div className="card-title h6">
            {(price && statusType !== 'SOLD') ? `Price: ${currencyFormatter.format(PropAccessors.getPrice(property))}` : ''}
            {(price && statusType === 'SOLD') ? `Sold For: ${currencyFormatter.format(PropAccessors.getPrice(property))}` : ''}
            {(!price && statusType === 'SOLD') ? 'Unknown Sale Price' : ''}
            {(zestimate) ? ` (est. ${currencyFormatter.format(zestimate)})` : ''}
          </div>
          <div className="card-subtitle text-gray">
            Rent Estimate:
            {(rentzestimate) ? ` ${currencyFormatter.format(rentzestimate)}` : ' N/A'}
            {(livingArea && price) ? `, ${currencyFormatter.format(PropAccessors.getPricePerSqft(property))}/ft` : ''}
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
          {(rentzestimate && price) ? `R/P: ${(PropAccessors.getRentToPrice(property)).toFixed(2)}%` : ''}
          <br />
          {(rentzestimate && zestimate) ? `R/P (est.): ${(PropAccessors.getZestimateToPrice(property)).toFixed(2)}%` : ''}
        </div>
      </div>
    </div>
  );
}
