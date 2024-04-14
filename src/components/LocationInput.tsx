/// <reference types="google.maps" />
/* eslint-disable react/jsx-props-no-spreading */
import React, {
  ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Autocomplete,
  Box,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import parse from 'autosuggest-highlight/parse';
import pThrottle from 'p-throttle';
import { PlaceInfo } from '../common';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS || '';

const throttle = pThrottle({
  limit: 10, interval: 1000, strict: true,
});

type AutoCompleteService = {
  current: google.maps.places.AutocompleteService | null;
}
const autocompleteService: AutoCompleteService = { current: null };

function initMap() {
  if (!autocompleteService.current && window.google) {
    autocompleteService.current = new window.google.maps.places.AutocompleteService();
  }
}

declare global {
  interface Window {
    initMap: () => void;
  }
}

function loadScript(src: string, position: HTMLElement | null, id: string) {
  if (!position) {
    return;
  }
  // eslint-ignore-next-line
  window.initMap = initMap;
  const script = document.createElement('script');
  script.setAttribute('async', '');
  script.setAttribute('id', id);
  script.src = src;
  position.appendChild(script);
}

type Cache<T> = Record<
  string, {
    data: T;
    maxAge: number;
}>;
async function maybeFetch<T>(
  key: string,
  generator: () => Promise<T>,
  cacheKey = 'upa',
  cache = 24 * 60 * 60,
): Promise<T> {
  let cachedData: Cache<T> = {};
  try {
    cachedData = JSON.parse(sessionStorage.getItem(cacheKey) || '{}') as Cache<T>;
  } catch (error) {
    // Skip exception
  }
  cachedData = Object.keys(cachedData).reduce(
    (acc: Cache<T>, k: string) => {
      if (cachedData[k].maxAge - Date.now() >= 0) {
        acc[k] = cachedData[k];
      }
      return acc;
    },
    {} as Cache<T>,
  );

  if (cachedData[key]) {
    return cachedData[key].data;
  }
  const data = await generator();
  cachedData[key] = {
    data,
    maxAge: Date.now() + cache * 1000,
  };
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(cachedData));
  } catch (error) {
    // Skip exception
  }
  return data;
}

interface LocationInputProps {
  id: string;
  handleInput: (value: PlaceInfo) => void;
  placeholder: string;
  label: string;
  defaultValue: google.maps.places.AutocompletePrediction | undefined;
}

export default function LocationInput(
  {
    id,
    handleInput,
    defaultValue,
    placeholder,
    label,
  }: LocationInputProps,
): ReactElement {
  const [value, setValue] = useState(defaultValue || null);
  const [inputValue, setInputValue] = useState(defaultValue?.description || '');
  const [options, setOptions] = useState((defaultValue) ? [defaultValue] : []);
  const loaded = useRef(false);

  if (typeof window !== 'undefined' && !loaded.current) {
    if (!document.querySelector('#google-maps')) {
      loadScript(
        `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async&callback=initMap`,
        document.querySelector('head'),
        'google-maps',
      );
    }

    loaded.current = true;
  }

  const fetchData = useMemo(
    () => throttle(
      (request: google.maps.places.AutocompletionRequest) => {
        const remote = autocompleteService.current;
        if (!remote) {
          return null;
        }
        return maybeFetch(request.input, () => remote.getPlacePredictions(request));
      },
    ),
    [],
  );

  useEffect(() => {
    let active = true;
    initMap();
    if (!autocompleteService.current) {
      return undefined;
    }

    if (inputValue === '') {
      setOptions(value ? [value] : []);
      return undefined;
    }
    const fn = async () => {
      const results = await fetchData({ input: inputValue });
      if (active) {
        let newOptions: google.maps.places.AutocompletePrediction[] = [];
        if (value) {
          newOptions = [value];
        }
        if (results) {
          newOptions = [...newOptions, ...results.predictions];
        }
        setOptions(newOptions);
      }
    };
    const _ = fn();
    return () => {
      active = false;
    };
  }, [value, inputValue, fetchData]);

  return (
    <Autocomplete
      autoComplete
      includeInputInList
      filterSelectedOptions
      fullWidth
      id={id}
      isOptionEqualToValue={(option, val) => option.description === val.description}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.description)}
      filterOptions={(x) => x}
      options={options}
      value={value}
      onChange={(event, prediction: google.maps.places.AutocompletePrediction | null) => {
        setOptions(prediction ? [prediction, ...options] : options);
        setValue(prediction);
        if (prediction) {
          const { place_id, description } = prediction; // eslint-disable-line camelcase
          handleInput({
            placeId: place_id, // eslint-disable-line camelcase
            description,
            prediction,
          });
        }
      }}
      onInputChange={(event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          fullWidth
          inputProps={{ ...params.inputProps, placeholder }}
        />
      )}
      renderOption={(props, option) => {
        const matches = option.structured_formatting.main_text_matched_substrings;
        const parts = parse(
          option.structured_formatting.main_text,
          matches.map(({ offset, length }) => [offset, offset + length]),
        );

        return (
          <li {...props}>
            <Grid container alignItems="center">
              <Grid item>
                <Box
                  component={LocationOnIcon}
                  sx={{ color: 'text.secondary', mr: 2 }}
                />
              </Grid>
              <Grid item xs>
                {parts.map((part) => (
                  <span
                    key={`${id}${part.text}`}
                    style={{
                      fontWeight: part.highlight ? 700 : 400,
                    }}
                  >
                    {part.text}
                  </span>
                ))}
                <Typography variant="body2" color="text.secondary">
                  {option.structured_formatting.secondary_text}
                </Typography>
              </Grid>
            </Grid>
          </li>
        );
      }}
    />
  );
}
