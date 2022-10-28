/* eslint-disable react/jsx-props-no-spreading */
import classnames from 'classnames';

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
  FormControl,
  FormControlLabel,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';

import { LoadingButton } from '@mui/lab';

import React, { useEffect, useState } from 'react';
import { CSVLink } from 'react-csv';
import styled from 'styled-components';
import { useQueryParam } from 'use-query-params';
import {
  DefaultFetchPropertiesRequest,
  DefaultLocalSettings,
  FetchPropertiesRequest,
  LocalFilterSettings,
  notEmpty,
  PlaceInfo,
  Property,
  SortOrder,
} from '../common';
import { CUTTLY_API_KEY, urlShortnerEndpoint } from '../constants';
import LocationInput from './LocationInput';
import styles from './styles.module.css';
import { CuttlyApiResponse, getJsonResponse } from '../utilities';

const FormRow = styled.div`
  padding-top: 10px;
  padding-bottom: 10px;
  text-align: left;
`;

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

  const containerClasses = classnames('container', 'mb-1', styles.container);
  const formClasses = classnames('form-horizontal', styles.form);
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
  return (
    <div className={containerClasses}>
      <form
        className={formClasses}
        noValidate
      >
        <h1>Refine your results</h1>
        <FormRow className="columns text-center">
          <div className="column col-3 col-xs-12">
            <div className="col-sm-12">
              <label className="form-label" htmlFor="geo-location">
                Search Center
              </label>
            </div>
            <LocationInput
              id="geo-location"
              placeholder="Nacogdoches, TX"
              handleInput={(place: PlaceInfo) => setRemoteForm((
                latestForm: FetchPropertiesRequest,
              ) => ({
                ...latestForm,
                geoLocation: place,
              }))}
              defaultValue={remoteForm.geoLocation.address}
            />
          </div>
          <div className="column col-3 col-xs-12">
            <div className="col-sm-12">
              <label className="form-label" htmlFor="commute-location">
                Commute Location
              </label>
            </div>
            <LocationInput
              id="commute-location"
              placeholder="1600 Amphitheatre Parkway, Mountain View, CA"
              handleInput={(place: PlaceInfo) => setRemoteForm((
                latestForm: FetchPropertiesRequest,
              ) => ({
                ...latestForm,
                commuteLocation: place,
              }))}
              defaultValue={remoteForm.commuteLocation.address}
            />
          </div>
          <div className="column col-2 col-xs-5">
            <div className="form-group">
              <div className="col-5 col-sm-12">
                <label className="form-label" htmlFor="radius">
                  Radius
                </label>
              </div>
              <div className="col-5 col-sm-12">
                <input
                  className="form-input"
                  min="0.25"
                  max="40"
                  type="number"
                  id="radius"
                  placeholder="3"
                  value={remoteForm.radius}
                  step="0.25"
                  onChange={(event) => setRemoteForm((latestForm: FetchPropertiesRequest) => ({
                    ...latestForm,
                    radius: Number(event.target.value),
                  }))}
                />
              </div>
            </div>
          </div>
          <div className="column col-4 col-xs-12">
            <div className="form-group">
              <div className="col-3 col-sm-12">
                <label className="form-label" htmlFor="price-most">
                  High
                </label>
              </div>
              <div className="col-4 col-sm-12">
                <input
                  className="form-input"
                  min="0"
                  max="10000000"
                  type="number"
                  id="price-most"
                  placeholder="1000000"
                  step="50000"
                  value={remoteForm.priceMost || ''}
                  onChange={(event) => setRemoteForm((latestForm: FetchPropertiesRequest) => ({
                    ...latestForm,
                    priceMost: Number(event.target.value),
                  }))}
                />
              </div>
            </div>
          </div>
        </FormRow>
        <FormRow className="columns text-center">
          <div className="column col-5 col-xs-12">
            <div className="form-group">
              <div className="col-4 col-sm-8">
                <label className="form-label" htmlFor="sortorder">
                  Sort
                </label>
              </div>
              <div className="col-8 col-sm-10">
                <select
                  className="form-select"
                  id="sortorder"
                  disabled={all.length === 0}
                  value={localForm.sortOrder}
                  onChange={(event) => setLocalForm((latestForm: LocalFilterSettings) => ({
                    ...latestForm,
                    sortOrder: event.target.value as SortOrder,
                  }))}
                >
                  {localForm.sortOrders.map((order) => (
                    <option key={order} value={order}>
                      {order}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </FormRow>
        <FormControl component="fieldset">
          <Stack direction="row" alignItems="center" justifyContent="space-evenly" spacing={5}>
            <FormControlLabel
              value="top"
              label="Price to Rent Ratio"
              labelPlacement="top"
              control={(
                <Box sx={{ width: 200 }}>
                  <Slider
                    getAriaLabel={(index) => `${(index === 0) ? 'Minimum' : 'Maximum'} Price to Rent Ratio`}
                    id="meets-rule"
                    valueLabelDisplay="auto"
                    disableSwap
                    step={0.1}
                    min={DefaultLocalSettings.meetsRule[0]}
                    max={DefaultLocalSettings.meetsRule[1]}
                    disabled={all.length === 0}
                    value={localForm.meetsRule}
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
                      setLocalForm((latestForm: LocalFilterSettings) => ({
                        ...latestForm,
                        meetsRule: [min, max],
                      }));
                    }}
                    getAriaValueText={(value: number) => `${value}%`}
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
                      {`${localForm.meetsRule[0]}%`}
                    </TinyText>
                    <TinyText>
                      {`${localForm.meetsRule[1]}%`}
                    </TinyText>
                  </Box>
                </Box>
              )}
            />
            <Autocomplete
              multiple
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
          </Stack>
          <Stack direction="row" alignItems="center" justifyContent="space-evenly" spacing={5}>
            {switches.map(renderSwitch)}
          </Stack>
        </FormControl>
        <FormRow className="columns text-center">
          <div className="column col-5 col-xs-5">
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
          </div>
          <div className="column col-5 col-xs-5">
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
          </div>
          <CSVLink
            data={results}
            filename="properties.csv"
            type="button"
          >
            <Button variant="outlined" startIcon={<DownloadIcon />}>
              Download
            </Button>
          </CSVLink>
        </FormRow>
      </form>
    </div>
  );
}
