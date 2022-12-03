import React, { ReactElement } from 'react';
import {
  Box,
  Collapse,
  FormControlLabel,
  Switch,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

import styled from 'styled-components';

import {
  currencyFormatter,
  notEmpty,
  PropAccessors,
  Property,
} from '../common';

const Header = styled.h3`
  text-align: center;
  margin-top: 1em;
`;

type ResultSummaryProps = {
  all: Property[];
  filtered: Property[];
  showAnalytics: boolean;
  setShowAnalytics: (_: boolean) => void;
};

type SummaryStatistics = {
  average: number;
  median: number;
  minimum: number;
  maximum: number;
  // This only exists samples with 2 or more values.
  stddev: number | null;
};

type Summary = {
  price: SummaryStatistics | null;
  rentzestimate: SummaryStatistics | null;
  travelTime: SummaryStatistics | null;
  zestimate: SummaryStatistics | null;
  perSqFt: SummaryStatistics | null;
  rentToPrices: SummaryStatistics | null;
  zestimateToPrice: SummaryStatistics | null;
};

/*
  Computes the summary statistics for the values.

  @param values - The values used to create the summary statistics.

  @returns The summary statistics as defined. If empty array is given, null.
*/
const compute = (values: number[]): SummaryStatistics | null => {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values];
  sorted.sort((a, b) => a - b);
  const average = values.reduce((a, b) => a + b) / values.length;
  const median = sorted[Math.floor(values.length / 2)];
  const minimum = sorted[0];
  const maximum = sorted[sorted.length - 1];
  if (values.length === 1) {
    return {
      average, median, minimum, maximum, stddev: null,
    };
  }
  const stddev = Math.sqrt(
    values
      .map((val) => (val - average) ** 2)
      .reduce((a, b) => a + b) / (values.length - 1),
  );
  return {
    average, median, minimum, maximum, stddev,
  };
};

/*
  Summarizes the give list of properties.

  @param props - The properties used to create the summary.

  @returns A summary. Non-existant values are droppped.
*/
const summarize = (props: Property[]): Summary => {
  type PropertyKey = keyof Property;
  const fetch = (key: PropertyKey): number[] => props.map((prop) => {
    if (!prop[key] || typeof prop[key] !== 'number') {
      return null;
    }
    return prop[key] as number;
  }).filter(notEmpty);
  return {
    price: compute(fetch('price')),
    rentzestimate: compute(fetch('rentzestimate')),
    travelTime: compute(fetch('travelTime')),
    zestimate: compute(fetch('zestimate')),
    perSqFt: compute(props.map(PropAccessors.getPricePerSqft)),
    rentToPrices: compute(props.map(PropAccessors.getRentToPrice)),
    zestimateToPrice: compute(props.map(PropAccessors.getZestimateToPrice)),
  };
};

type NumberFormat = 'currency' | 'commute' | 'ratio';
type StatisticsProps = {
  name: string;
  stats: SummaryStatistics;
  type: NumberFormat;
};
function StatsRow({
  name, stats: {
    average, median, minimum, maximum, stddev,
  },
  type,
}: StatisticsProps): ReactElement {
  const format = (val: number): string => {
    if (type === 'currency') {
      return currencyFormatter.format(val);
    }
    if (type === 'commute') {
      return `${(val / 60).toFixed(1)} min`;
    }
    if (type === 'ratio') {
      return `${val.toFixed(2)}%`;
    }
    return `${val}`;
  };
  return (
    <TableRow
      key={name}
      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
    >
      <TableCell component="th" scope="row">
        {name}
      </TableCell>
      <TableCell align="center">{format(average)}</TableCell>
      <TableCell align="center">{((stddev) ? ` (${format(average - stddev)}, ${format(average + stddev)})` : 'N/A')}</TableCell>
      <TableCell align="center">{format(median)}</TableCell>
      <TableCell align="center">{format(minimum)}</TableCell>
      <TableCell align="center">{format(maximum)}</TableCell>
    </TableRow>
  );
}

export default function ResultSummary({
  all, filtered, showAnalytics, setShowAnalytics,
}: ResultSummaryProps): ReactElement {
  const heading = (all.length > 0) ? `Results: ${filtered.length} of ${all.length}.` : 'No Results';
  if (all.length === 0 || filtered.length === 0) {
    return <Header>{heading}</Header>;
  }

  const {
    price, rentzestimate, travelTime, zestimate, perSqFt, rentToPrices, zestimateToPrice,
  } = summarize(filtered);
  return (
    <Box>
      <FormControlLabel
        control={(
          <Switch
            name="analytics"
            size="medium"
            checked={showAnalytics}
            onChange={(event) => setShowAnalytics(event.target.checked)}
          />
        )}
        label="Analytics"
      />
      <Collapse in={showAnalytics}>
        <Header>{heading}</Header>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} size="small" aria-label="Analytics">
            <TableHead>
              <TableRow>
                <TableCell>Metric</TableCell>
                <TableCell>Average</TableCell>
                <TableCell align="center">Confidence Interval</TableCell>
                <TableCell align="center">Median</TableCell>
                <TableCell align="center">Minimum</TableCell>
                <TableCell align="center">Maximum</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              { price && <StatsRow name="Price" stats={price} type="currency" /> }
              { travelTime && <StatsRow name="Commute" stats={travelTime} type="commute" /> }
              { perSqFt && <StatsRow name="Price/sqft" stats={perSqFt} type="currency" /> }
              { rentzestimate && <StatsRow name="Rents" stats={rentzestimate} type="currency" /> }
              { rentToPrices && <StatsRow name="Rent to Price Ratio" stats={rentToPrices} type="ratio" /> }
              { zestimate && <StatsRow name="Zestimate" stats={zestimate} type="currency" /> }
              { zestimateToPrice && <StatsRow name="Estimate to Price" stats={zestimateToPrice} type="ratio" /> }
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>
    </Box>
  );
}
