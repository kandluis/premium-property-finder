import React from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Property } from '../common';

const columns: GridColDef[] = [
  { field: 'address', headerName: 'Address', type: 'string' },
  { field: 'detailUrl', headerName: 'detailUrl', type: 'string' },
  { field: 'imgSrc', headerName: 'imgSrc', type: 'string' },
  { field: 'price', headerName: 'price', type: 'number' },
  { field: 'statusType', headerName: 'statusType', type: 'string' },
  { field: 'statusText', headerName: 'statusText', type: 'string' },
  { field: 'listingType', headerName: 'listingType', type: 'string' },
  { field: 'area?', headerName: 'area?', type: 'number' },
  { field: 'baths?', headerName: 'baths?', type: 'number' },
  { field: 'beds?', headerName: 'beds?', type: 'number' },
  { field: 'city?', headerName: 'city?', type: 'string' },
  { field: 'homeType?', headerName: 'homeType?', type: 'string' },
  { field: 'lastSold?', headerName: 'lastSold?', type: 'string' },
  { field: 'livingArea?', headerName: 'livingArea?', type: 'number' },
  { field: 'lotArea?', headerName: 'lotArea?', type: 'number' },
  { field: 'rentzestimate?', headerName: 'rentzestimate?', type: 'number' },
  { field: 'state?', headerName: 'state?', type: 'string' },
  { field: 'travelTime?', headerName: 'travelTime?', type: 'number' },
  { field: 'zestimate?', headerName: 'zestimate?', type: 'number' },
  { field: 'zipCode?', headerName: 'zipCode?', type: 'number' },
  { field: 'zpid?', headerName: 'zpid?', type: 'number' },
];

interface PropertyTableProps {
  properties: Property[];
}

export default function PropertyTable({ properties }: PropertyTableProps) {
  return (
    <DataGrid
      autoHeight
      autoPageSize
      rows={properties}
      columns={columns}
      disableSelectionOnClick
      getRowId={(row: Property) => `${row.detailUrl}`}
    />
  );
}
