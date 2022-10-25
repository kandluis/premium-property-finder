import React, { ReactElement, useState } from 'react';
import styled from 'styled-components';

import { notEmpty, PropAccessors, Property } from '../common';

const Header = styled.h3`
  text-align: center;
  margin-top: 1em;
`;

const StatsDiv = styled.div`
  text-align: center;
  display: table-cell;
  padding: 5px;
`;

const SummaryDiv = styled.div`
  display: table;
  table-layout: fixed;
  width: 100%;
`;

const StatTitle = styled.div`
  font-weight: bold;
  text-align: center;
`;

type ResultSummaryProps = {
  all: Property[];
  filtered: Property[];
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
  show: boolean;
};
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumSignificantDigits: 3,
});
function Statistics({
  name, stats: {
    average, median, minimum, maximum, stddev,
  },
  type,
  show,
}: StatisticsProps): ReactElement {
  const [shown, setShown] = useState(show);
  const format = (val: number): string => {
    if (type === 'currency') {
      return currencyFormatter.format(val);
    }
    if (type === 'commute') {
      return `${(val / 60).toFixed(1)} min`;
    }
    if (type === 'ratio') {
      return `${val.toFixed(2)}`;
    }
    return `${val}`;
  };
  const averageStr = `${format(average)}${((stddev) ? ` [${format(average - stddev)}, ${format(average + stddev)}]` : '')}`;
  const rangeStr = `${format(minimum)}=>${format(maximum)}`;
  return (
    <StatsDiv>
      <StatTitle>
        <button
          type="button"
          onClick={() => setShown((wasShown) => !wasShown)}
        >
          { (shown) ? `▼ ${name}` : '►'}
        </button>
      </StatTitle>
      {shown && `Avg: ${averageStr}`}
      {shown && <br />}
      {shown && `Med: ${format(median)} (${rangeStr})`}
    </StatsDiv>
  );
}

export default function ResultSummary({ all, filtered }: ResultSummaryProps): ReactElement {
  const [showAnalytics, setShowAnalytics] = useState(true);

  const heading = (all.length > 0) ? `Results: ${filtered.length} of ${all.length}.` : 'No Results';
  if (all.length === 0 || filtered.length === 0) {
    return <Header>{heading}</Header>;
  }

  const {
    price, rentzestimate, travelTime, zestimate, perSqFt, rentToPrices, zestimateToPrice,
  } = summarize(filtered);
  return (
    <>
      <Header>{heading}</Header>
      <h3>
        <button
          type="button"
          onClick={() => setShowAnalytics((shown) => !shown)}
        >
          { (showAnalytics) ? '▼ Analytics' : '►'}
        </button>
      </h3>
      {showAnalytics && (
        <SummaryDiv>
          { price && <Statistics name="Price" stats={price} type="currency" show /> }
          { travelTime && <Statistics name="Commute" stats={travelTime} type="commute" show /> }
          { perSqFt && <Statistics name="$/SqFt" stats={perSqFt} type="currency" show /> }
          { rentzestimate && <Statistics name="Rents" stats={rentzestimate} type="currency" show={false} /> }
          { rentToPrices && <Statistics name="Rent:Price" stats={rentToPrices} type="ratio" show /> }
          { zestimate && <Statistics name="Zestimate" stats={zestimate} type="currency" show={false} /> }
          { zestimateToPrice && <Statistics name="Est.:Price" stats={zestimateToPrice} type="ratio" show={false} /> }
        </SummaryDiv>
      )}
    </>
  );
}
