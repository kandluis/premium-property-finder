import React from 'react';
import {
  DataGrid,
  GridColDef,
  GridValueFormatterParams,
} from '@mui/x-data-grid';
import {
  currencyFormatter,
  PropAccessors,
  Property,
  openInNewTab,
} from '../common';

function formatCurrency(params: GridValueFormatterParams<number>): string {
  if (params.value == null) {
    return '';
  }

  return currencyFormatter.format(params.value);
}

type Row = {
  row: Property;
}

const columns: GridColDef[] = [
  {
    field: 'address',
    headerName: 'Address',
    type: 'string',
    valueGetter: ({ row }: Row) => `${row.address}, ${row.city || 'Unknown'} ${row.state || 'NA'} ${row.zipCode || ''}`,
    flex: 1,
    minWidth: 200,
  },
  {
    field: 'price',
    headerName: 'Price',
    type: 'number',
    valueFormatter: formatCurrency,
    minWidth: 100,
    flex: 1,
  },
  {
    field: 'persqft',
    headerName: 'Price/sqft',
    type: 'number',
    valueGetter: ({ row }: Row) => PropAccessors.getPricePerSqft(row),
    valueFormatter: formatCurrency,
    flex: 1,
    minWidth: 100,
  },
  {
    field: 'renttoprice',
    headerName: 'Rent to Price Ratio',
    type: 'number',
    valueGetter: ({ row }: Row) => PropAccessors.getRentToPrice(row),
    valueFormatter: ({ value }: GridValueFormatterParams<number>) => `${value.toFixed(2)}%`,
    flex: 1,
    minWidth: 50,
  },
  {
    field: 'area',
    headerName: 'Living Area',
    type: 'number',
    minWidth: 100,
    flex: 1,
  },
  {
    field: 'baths',
    headerName: 'Baths',
    type: 'number',
    minWidth: 25,
  },
  {
    field: 'beds',
    headerName: 'Beds',
    type: 'number',
    minWidth: 25,
  },

  {
    field: 'rentzestimate',
    headerName: 'Rent Estimate',
    type: 'number',
    valueFormatter: formatCurrency,
    flex: 1,
  },
  {
    field: 'travelTime',
    headerName: 'Commute Time',
    type: 'number',
    valueFormatter: (params) => ((params.value) ? `${(params.value / 60).toFixed(1)} min` : ''),
    minWidth: 100,
    flex: 1,
  },
  {
    field: 'zestimate',
    headerName: 'Zestimate',
    type: 'number',
    valueFormatter: formatCurrency,
    flex: 1,
  },
];

interface PropertyTableProps {
  properties: Property[];
}

export default function PropertyTable({ properties }: PropertyTableProps) {
  return (
    <DataGrid
      autoHeight
      autoPageSize
      density="compact"
      rows={properties}
      columns={columns}
      pageSize={100}
      disableSelectionOnClick
      getRowId={(row: Property) => `${row.detailUrl}`}
      onRowClick={({ row }: { row: Property }) => {
        openInNewTab(`http://www.zillow.com${row.detailUrl}`);
      }}
    />
  );
}
