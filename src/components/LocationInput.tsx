import React, { useState, useEffect } from 'react';
import type { ChangeEvent, InputHTMLAttributes, ReactElement } from 'react';
import usePlacesAutocomplete, { getDetails } from 'use-places-autocomplete';
import type { HookReturn, Suggestion } from 'use-places-autocomplete';
import useOnclickOutside from 'react-cool-onclickoutside';
import pThrottle from 'p-throttle';
import { notEmpty, PlaceInfo } from '../common';

const throttle = pThrottle({
  limit: 5, interval: 1250, strict: true,
});

const getPlaceInfo = throttle(async ({
  place_id, // eslint-disable-line camelcase
  structured_formatting: { main_text }, // eslint-disable-line camelcase
}: Suggestion): Promise<PlaceInfo | null> => {
  const request = {
    placeId: place_id, // eslint-disable-line camelcase
    fields: ['formatted_address'],
  };
  const result = await getDetails(request);
  if (result === null || typeof (result) === 'string') {
    return null;
  }
  const { formatted_address } = result; // eslint-disable-line camelcase
  if (!formatted_address) { // eslint-disable-line camelcase
    return null;
  }
  return {
    placeId: place_id, // eslint-disable-line camelcase
    name: main_text, // eslint-disable-line camelcase
    address: formatted_address, // eslint-disable-line camelcase
  };
});

interface LocationInputProps extends InputHTMLAttributes<HTMLInputElement> {
  handleInput: (value: PlaceInfo) => void;
  defaultValue: string;
}

export default function LocationInput(
  { handleInput, defaultValue, ...inputProps }: LocationInputProps,
): ReactElement {
  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  }: HookReturn = usePlacesAutocomplete({
    defaultValue,
    debounce: 300,
  });
  const [placeDetails, setPlaceDetails] = useState<PlaceInfo[]>([]);
  const divRef = useOnclickOutside(() => {
    clearSuggestions();
  });

  const handleOnChange = ({ target }: ChangeEvent<HTMLInputElement>): void => {
    const match = placeDetails.filter(({ address }) => (address === target.value));
    if (match.length === 1) {
      handleInput(match[0]);
    }
    // On empty input, reset the form.
    if (target.value === '') {
      handleInput({ placeId: '', name: '', address: '' });
    }
    setValue(target.value, match.length === 0);
  };
  const renderSuggestions = () => placeDetails.map(({
    placeId, name, address,
  }) => (<option key={placeId} value={address}>{name}</option>));

  useEffect(() => {
    const fetchDetails = async () => {
      const results = (await Promise.all(data.map(async (val) => {
        const res = await getPlaceInfo(val);
        return res;
      }))).filter(notEmpty);
      setPlaceDetails(results);
    };
    const _ = fetchDetails();
  }, [data, value.length]);
  const { id } = inputProps;
  const listId = `autocomplete-data-${id || ''}`;
  return (
    <div className="col-10 col-sm-12" ref={divRef}>
      <input
        className="form-input"
        type="text"
        value={value}
        onChange={handleOnChange}
        disabled={!ready}
        list={listId}
        {...inputProps}
      />
      {/* We can use the 'status' to decide whether we should display the dropdown or not */}
      <datalist id={listId}>{status === 'OK' && renderSuggestions()}</datalist>
    </div>
  );
}
