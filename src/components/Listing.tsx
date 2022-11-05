import React from 'react';
import {
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Typography,
} from '@mui/material';
import { openInNewTab, PropAccessors, Property } from '../common';

type ListingProps = {
  property: Property,
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumSignificantDigits: 4,
});

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
  return (
    <Card>
      <CardActionArea
        onClick={() => openInNewTab(`http://www.zillow.com${detailUrl}`)}
        onKeyPress={() => openInNewTab(`http://www.zillow.com${detailUrl}`)}
        role="link"
        tabIndex={0}
        style={{ cursor: 'pointer' }}
      >
        <CardMedia component="img" image={finalImgSrc} alt={imgAltText} />
        <CardContent>
          <Typography gutterBottom variant="h6" component="div">
            {(statusType === 'SOLD' && lastSold) ? `[${lastSold}] ${title}` : title}
            ,
            {' '}
            {city || 'Unknown'}
            {' '}
            {state || 'NA'}
          </Typography>
          <Typography gutterBottom variant="subtitle1" component="div">
            {(price && statusType !== 'SOLD') ? `Price: ${currencyFormatter.format(PropAccessors.getPrice(property))}` : ''}
            {(price && statusType === 'SOLD') ? `Sold For: ${currencyFormatter.format(PropAccessors.getPrice(property))}` : ''}
            {(!price && statusType === 'SOLD') ? 'Unknown Sale Price' : ''}
            {(zestimate) ? ` (est. ${currencyFormatter.format(zestimate)})` : ''}
          </Typography>
          <Typography gutterBottom variant="body1" component="div">
            Rent Estimate:
            {(rentzestimate) ? ` ${currencyFormatter.format(rentzestimate)}` : ' N/A'}
            {(livingArea && price) ? `, ${currencyFormatter.format(PropAccessors.getPricePerSqft(property))}/ft` : ''}
          </Typography>
          <Typography variant="body2" color="text.secondary">
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
            {(rentzestimate && price) ? `Rent/Price: ${(PropAccessors.getRentToPrice(property)).toFixed(2)}%` : ''}
            <br />
            {(rentzestimate && zestimate) ? `Zestimate/Price (est.): ${(PropAccessors.getZestimateToPrice(property)).toFixed(2)}%` : ''}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
