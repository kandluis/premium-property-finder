/* eslint-disable react/jsx-props-no-spreading */
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import DownloadIcon from '@mui/icons-material/Download';
import SendIcon from '@mui/icons-material/Send';
import ShareIcon from '@mui/icons-material/Share';

import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Collapse,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Grid2 from '@mui/material/Unstable_Grid2';

import { LoadingButton } from '@mui/lab';

import React, { useContext, useEffect, useState } from 'react';
import { CSVLink } from 'react-csv';
import styled from 'styled-components';
import { useQueryParam } from 'use-query-params';
import {
  ColorModeContext,
  DefaultFetchPropertiesRequest,
  DefaultLocalSettings,
  currencyFormatter,
  FetchPropertiesRequest,
  LocalFilterSettings,
  notEmpty,
  PlaceInfo,
  Property,
  SortOrder,
} from '../common';
import { CUTTLY_API_KEY, urlShortnerEndpoint } from '../constants';
import LocationInput from './LocationInput';
import { CuttlyApiResponse, getJsonResponse } from '../utilities';

const TinyText = styled(Typography)({
  fontSize: '0.75rem',
  opacity: 0.38,
  fontWeight: 500,
  letterSpacing: 0.2,
});

type FilterProps = {
  // Callback to update local state.
  localUpdate: (localSettings: LocalFilterSettings) => void,
  // Callback to update remote state (need to fetch new properties).
  remoteUpdate: (remoteSettings: FetchPropertiesRequest) => void,
  // The currently displayed list of results. Used to generate download CSV.
  results: Property[],
  // All fetched data, not just that displayed.
  all: Property[],
  // If we're currently loading data.
  loading: boolean;
};

const RemoteParser = {
  encode(value: FetchPropertiesRequest): string {
    return btoa(JSON.stringify(value, undefined, 1));
  },
  decode(value: string | (string | null)[] | null | undefined): FetchPropertiesRequest {
    if (!value || Array.isArray(value)) {
      return DefaultFetchPropertiesRequest;
    }
    return JSON.parse(atob(value)) as FetchPropertiesRequest;
  },
};
const LocalParser = {
  encode(value: LocalFilterSettings) {
    return btoa(JSON.stringify(value, undefined, 1));
  },
  decode(value: string | (string | null)[] | null | undefined): LocalFilterSettings {
    if (!value || Array.isArray(value)) {
      return DefaultLocalSettings;
    }
    return JSON.parse(atob(value)) as LocalFilterSettings;
  },
};

type ShareLinkState = {
  // The link to share/copy to clip.
  link: string | null;
  // Whether we're loading link sharing.
  loading: boolean;
  // Whether we've attempted creating a shortlink already for this page.
  attempted: boolean;
}
const DefaultShareLinkState = {
  link: null,
  loading: false,
  attempted: false,
};

type SwitchOptions = {
  title: string;
  localKey?: keyof LocalFilterSettings;
  remoteKey?: keyof FetchPropertiesRequest;
};

export default function Filter({
  remoteUpdate, localUpdate, results, all, loading,
}: FilterProps) {
  const [share, setShare] = useState<ShareLinkState>(DefaultShareLinkState);
  const [remoteForm, setRemoteForm] = useQueryParam('remote', RemoteParser);
  const [localForm, setLocalForm] = useQueryParam('local', LocalParser);
  const [priceBounds, setPriceBounds] = useState([remoteForm.priceFrom, remoteForm.priceMost]);
  const [ratioBounds, setRatioBounds] = useState(localForm.meetsRule);
  const [showFilter, setShowFilter] = useState(true);
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);
  remoteForm.commuteLocation = remoteForm.commuteLocation || remoteForm.geoLocation;

  const renderSwitch = ({ title, localKey, remoteKey }: SwitchOptions) => (
    <FormControlLabel
      key={localKey || remoteKey}
      value="top"
      label={title}
      labelPlacement="top"
      control={(
        <Switch
          color="primary"
          checked={(localKey && localForm[localKey] as boolean)
            || (remoteKey && remoteForm[remoteKey] as boolean) || false}
          disabled={all.length === 0}
          onChange={(event) => {
            if (localKey) {
              setLocalForm((latestForm: LocalFilterSettings) => ({
                ...latestForm,
                [localKey]: event.target.checked,
              }));
            }
            if (remoteKey) {
              setRemoteForm((latestForm: FetchPropertiesRequest) => ({
                ...latestForm,
                [remoteKey]: event.target.checked,
              }));
            }
          }}
        />
      )}
    />
  );

  const onShareClick = async () => {
    setShare({ link: null, loading: true, attempted: false });
    const urlReq = `${urlShortnerEndpoint}?key=${CUTTLY_API_KEY}&short=${encodeURIComponent(window.location.href)}`;
    const { url } = await getJsonResponse(urlReq, 'json', true) as CuttlyApiResponse;
    const shortLink = (url.status === 7) ? url.shortLink : null;
    if (shortLink) {
      await navigator.clipboard.writeText(url.shortLink);
    }
    setShare({ link: shortLink, loading: false, attempted: true });
  };

  // When form is updated, make appropriate requests.
  useEffect(() => {
    remoteUpdate(remoteForm);
  }, [remoteForm, remoteUpdate]);
  useEffect(() => {
    localUpdate(localForm);
  }, [localForm, localUpdate]);

  // Also reset sharing link when anything in the form changes.
  useEffect(() => {
    setShare(DefaultShareLinkState);
  }, [remoteForm, localForm]);

  const getHomeType = (prop: Property): string => {
    if (!prop.homeType) {
      return '';
    }
    const parts = prop.homeType.split('_');
    const upper = parts.map((part) => `${part[0]}${part.toLowerCase().slice(1)}`);
    return upper.join(' ');
  };
  const homeTypes = ([...new Set(all.map(getHomeType))].filter(notEmpty)).sort();
  if (localForm.homeTypes === null && homeTypes.length > 0) {
    localForm.homeTypes = (homeTypes.includes('Single Family')) ? ['Single Family'] : homeTypes;
  }
  const switches: SwitchOptions[] = [
    { title: 'Include Recently Sold', remoteKey: 'includeRecentlySold' },
    { title: 'Only If Rent is Available', localKey: 'rentOnly' },
    { title: 'Only New Construction', localKey: 'newConstruction' },
    { title: 'Include Land', localKey: 'includeLand' },
  ];
  const gridProps = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };
  const columnSizes = { xs: 4, sm: 8, md: 12 };
  const cols = (nxs: number, nsm: number, nmd: number) => ({
    xs: columnSizes.xs / nxs,
    sm: columnSizes.sm / nsm,
    md: columnSizes.md / nmd,
  });
  return (
    <Paper elevation={2}>
      <Grid2 container spacing={{ xs: 1, md: 2 }}>
        <Grid2 xs={11} {...gridProps} justifyContent="left">
          <h1>
            <Switch
              name="analytics"
              size="medium"
              checked={showFilter}
              onChange={(event) => setShowFilter(event.target.checked)}
            />
            Refine your results
          </h1>
        </Grid2>
        <Grid2 xs={1} {...gridProps} justifyContent="right">
          <IconButton sx={{ ml: 1 }} onClick={colorMode.toggleColorMode} color="inherit">
            {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Grid2>
      </Grid2>
      <Collapse in={showFilter}>
        <Grid2 container spacing={{ xs: 2, md: 3 }} columns={columnSizes}>
          <Grid2 {...cols(1, 2, 4)} {...gridProps}>
            <LocationInput
              id="geo-location"
              placeholder="Sunnyvale, CA"
              label="Search Center"
              handleInput={(place: PlaceInfo) => setRemoteForm((
                latestForm: FetchPropertiesRequest,
              ) => ({
                ...latestForm,
                geoLocation: place,
              }))}
              defaultValue={remoteForm.geoLocation.prediction}
            />
          </Grid2>
          <Grid2 {...cols(1, 2, 4)} {...gridProps}>
            <LocationInput
              id="commute-location"
              label="Commute Location"
              placeholder="Googleplex"
              handleInput={(place: PlaceInfo) => setRemoteForm((
                latestForm: FetchPropertiesRequest,
              ) => ({
                ...latestForm,
                commuteLocation: place,
              }))}
              defaultValue={remoteForm.commuteLocation.prediction}
            />
          </Grid2>
          <Grid2 {...cols(1, 2, 4)} {...gridProps}>
            <FormControl sx={{ m: 1, minWidth: 80 }}>
              <InputLabel id="radius-label">Search Radius</InputLabel>
              <Select
                autoWidth
                labelId="radius-label"
                id="radius"
                label="Search Radius"
                value={remoteForm.radius}
                onChange={(event) => setRemoteForm((latestForm: FetchPropertiesRequest) => ({
                  ...latestForm,
                  radius: Number(event.target.value),
                }))}
              >
                {[...Array(40).keys()].map((item) => (item + 1) / 5).map((value) => (
                  <MenuItem key={value} value={value}>
                    {`${value.toFixed(1)} miles`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid2>
          <Grid2 {...cols(1, 2, 4)} {...gridProps}>
            <FormControlLabel
              value="top"
              label="Price"
              labelPlacement="top"
              control={(
                <Box sx={{ minWidth: '200px' }}>
                  <Slider
                    getAriaLabel={(index) => `${(index === 0) ? 'Minimum' : 'Maximum'} Price`}
                    id="price-filter"
                    valueLabelDisplay="auto"
                    disableSwap
                    step={50000}
                    min={DefaultFetchPropertiesRequest.priceFrom}
                    max={2 * DefaultFetchPropertiesRequest.priceMost}
                    value={priceBounds}
                    onChange={(event, newValue: number | number[], activeThumb: number) => {
                      if (!Array.isArray(newValue)) {
                        return;
                      }
                      let [min, max] = newValue;
                      const minDistance = 50000;
                      if (max - min < minDistance) {
                        if (activeThumb === DefaultFetchPropertiesRequest.priceFrom) {
                          const clamped = Math.min(
                            min,
                            DefaultFetchPropertiesRequest.priceMost - minDistance,
                          );
                          [min, max] = [clamped, clamped + minDistance];
                        } else {
                          const clamped = Math.max(max, minDistance);
                          [min, max] = [clamped - minDistance, clamped];
                        }
                      }
                      setPriceBounds([min, max]);
                    }}
                    onChangeCommitted={(event, newValue: number | number[]) => {
                      if (!Array.isArray(newValue)) {
                        return;
                      }
                      setRemoteForm((latestForm: FetchPropertiesRequest) => ({
                        ...latestForm,
                        priceFrom: newValue[0],
                        priceMost: newValue[1],
                      }));
                    }}
                    getAriaValueText={
                      (value: number) => currencyFormatter.format(value)
                    }
                    valueLabelFormat={
                      (value: number) => currencyFormatter.format(value)
                    }
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mt: -1,
                    }}
                  >
                    <TinyText>
                      {currencyFormatter.format(priceBounds[0])}
                    </TinyText>
                    <TinyText>
                      {currencyFormatter.format(priceBounds[1])}
                    </TinyText>
                  </Box>
                </Box>
              )}
            />
          </Grid2>
          <Grid2 {...cols(1, 3, 3)} {...gridProps}>
            <FormControlLabel
              value="top"
              label="Price to Rent Ratio"
              labelPlacement="top"
              control={(
                <Box sx={{ minWidth: '200px' }}>
                  <Slider
                    getAriaLabel={(index) => `${(index === 0) ? 'Minimum' : 'Maximum'} Price to Rent Ratio`}
                    id="meets-rule"
                    valueLabelDisplay="auto"
                    disableSwap
                    step={0.1}
                    min={DefaultLocalSettings.meetsRule[0]}
                    max={DefaultLocalSettings.meetsRule[1]}
                    disabled={all.length === 0}
                    value={ratioBounds}
                    onChange={(event, newValue: number | number[], activeThumb: number) => {
                      if (!Array.isArray(newValue)) {
                        return;
                      }
                      let [min, max] = newValue;
                      const minDistance = 0.1;
                      const [minBound, maxBound] = DefaultLocalSettings.meetsRule;
                      if (max - min < minDistance) {
                        if (activeThumb === minBound) {
                          const clamped = Math.min(min, maxBound - minDistance);
                          [min, max] = [clamped, clamped + minDistance];
                        } else {
                          const clamped = Math.max(max, minDistance);
                          [min, max] = [clamped - minDistance, clamped];
                        }
                      }
                      setRatioBounds([min, max]);
                    }}
                    onChangeCommitted={(event, newValue: number | number[]) => {
                      if (!Array.isArray(newValue)) {
                        return;
                      }
                      setLocalForm((latestForm: LocalFilterSettings) => ({
                        ...latestForm,
                        meetsRule: [newValue[0], newValue[1]],
                      }));
                    }}
                    getAriaValueText={(value: number) => `${value}%`}
                    valueLabelFormat={(value: number) => `${value}%`}
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mt: -1,
                    }}
                  >
                    <TinyText>
                      {`${ratioBounds[0]}%`}
                    </TinyText>
                    <TinyText>
                      {`${ratioBounds[1]}%`}
                    </TinyText>
                  </Box>
                </Box>
              )}
            />
          </Grid2>
          <Grid2 {...cols(1, 3, 3)} {...gridProps}>
            <Autocomplete
              multiple
              fullWidth
              disableCloseOnSelect
              id="hometype"
              limitTags={1}
              disabled={all.length === 0}
              options={homeTypes}
              value={localForm.homeTypes || homeTypes}
              onChange={(event, types: string[]) => setLocalForm(
                (latestForm: LocalFilterSettings) => ({
                  ...latestForm,
                  homeTypes: types,
                }),
              )}
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox
                    icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                    checkedIcon={<CheckBoxIcon fontSize="small" />}
                    style={{ marginRight: 8 }}
                    checked={selected}
                  />
                  {option}
                </li>
              )}
              renderInput={(params) => <TextField {...params} label="Home Type" />}
            />
          </Grid2>
          <Grid2 {...cols(1, 3, 3)} {...gridProps}>
            <Autocomplete
              multiple
              fullWidth
              disableCloseOnSelect
              id="sort-order"
              limitTags={3}
              disabled={all.length === 0}
              options={localForm.sortOrders}
              value={localForm.sortOrder}
              onChange={(event, orders: SortOrder[]) => {
                setLocalForm((latestForm: LocalFilterSettings) => {
                  const { sortOrder } = latestForm;
                  const maxPriority = Math.max(...sortOrder.map(
                    ({ priority }) => priority,
                  ).filter(notEmpty));
                  const updatedOrders = orders.reduce((acc, order) => {
                    const prev = sortOrder.find(({ ascending, dimension }) => (
                      dimension === order.dimension
                      && ascending === order.ascending));
                    if (!prev) {
                      // Did not find, means this is a new one.
                      acc.push({ ...order, priority: maxPriority + 1 });
                    } else {
                      acc.push(prev);
                    }
                    return acc;
                  }, [] as SortOrder[]);
                  updatedOrders.sort((a, b) => (a.priority || 0) - (b.priority || 0));
                  for (let i = 0; i < updatedOrders.length; i += 1) {
                    updatedOrders[i].priority = i;
                  }
                  return {
                    ...latestForm,
                    // Renumber starting from 0.
                    sortOrder: updatedOrders,
                  };
                });
              }}
              renderOption={(props, { dimension }: SortOrder, { selected }) => (
                <li {...props}>
                  <Checkbox
                    icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                    checkedIcon={<CheckBoxIcon fontSize="small" />}
                    style={{ marginRight: 8 }}
                    checked={selected}
                  />
                  {dimension}
                </li>
              )}
              getOptionLabel={({ dimension, priority, ascending }) => (
                `[${(priority !== undefined) ? priority : ''}] ${(ascending) ? 'Asc.' : 'Desc.'} ${dimension}`
              )}
              groupBy={({ ascending }) => ((ascending) ? 'Ascending' : 'Descending')}
              isOptionEqualToValue={(option, value) => (
                option.ascending === value.ascending && option.dimension === value.dimension
              )}
              renderInput={(params) => <TextField {...params} label="Sort By" />}
            />
          </Grid2>
          {switches.map((item) => (
            <Grid2 key={item.title} {...cols(2, 4, 4)} {...gridProps}>
              {renderSwitch(item)}
            </Grid2>
          ))}
          <Grid2 {...cols(1, 3, 3)} {...gridProps}>
            <LoadingButton
              onClick={() => {
                remoteUpdate(remoteForm);
              }}
              endIcon={<SendIcon />}
              variant="contained"
              size="medium"
              loadingPosition="end"
              loading={loading}
            >
              Submit
            </LoadingButton>
          </Grid2>
          <Grid2 {...cols(1, 3, 3)} {...gridProps}>
            { (share.link)
              ? (
                <input
                  type="text"
                  readOnly
                  value={share.link}
                />
              )
              : (
                <LoadingButton
                  onClick={() => {
                    const _ = (async () => {
                      await onShareClick();
                    })();
                  }}
                  startIcon={<ShareIcon />}
                  variant="outlined"
                  size="medium"
                  loadingPosition="start"
                  loading={share.loading}
                  color={(share.attempted) ? 'error' : undefined}
                >
                  Share
                </LoadingButton>
              )}
          </Grid2>
          <Grid2 {...cols(1, 3, 3)} {...gridProps}>
            <CSVLink
              data={results}
              filename="properties.csv"
              type="button"
            >
              <Button variant="outlined" startIcon={<DownloadIcon />}>
                Download
              </Button>
            </CSVLink>
          </Grid2>
        </Grid2>
      </Collapse>
    </Paper>
  );
}
