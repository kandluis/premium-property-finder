import * as React from 'react'
import { Link } from '@reach/router'
import classnames from 'classnames'

function Listing({ listing }) {
  if (!listing) {
    return null;
  }

  const { zpid, baths, beds, detailUrl, imgSrc, lotArea, price, statusText , rentzestimate } = listing;
  const address = detailUrl.split('/')[2].replace(/\-/g, ' ');
  const columnClasses = classnames('column', 'col-4', 'col-xs-12', 'mb-5');
  const cardClasses = classnames('card');
  return (
    <div className={columnClasses} style={{ margin: '1rem 0' }}>
      <div className={cardClasses}>
        <div className="card-image">
          <img className="img-responsive" src={imgSrc} alt={address} />
        </div>
        <div className="card-header">
          <div className="card-title h5">{address}</div>
          <div className="card-title h6">Price: $ {price}</div>
          <div className="card-subtitle text-gray">Rent Estimate: $ {rentzestimate}</div>
        </div>
        <div className="card-body">Beds: {beds}, Baths: {baths}, Rent:Price {(100* rentzestimate / price).toFixed(2) }%</div>
        <div className="card-footer">
          <a
            className='btn btn-primary'
            href={`http://www.zillow.com${detailUrl}`}
            target='_blank'
          >
            Go to property
          </a>
        </div>
      </div>
    </div>
  )
};

export { Listing };