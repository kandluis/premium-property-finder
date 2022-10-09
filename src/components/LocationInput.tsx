import React, { useState, useEffect } from 'react';
import type { ChangeEvent, ReactElement } from 'react';
import usePlacesAutocomplete, { getDetails } from 'use-places-autocomplete';
import type { HookReturn, Suggestion } from 'use-places-autocomplete';
import useOnclickOutside from 'react-cool-onclickoutside';
import pThrottle from 'p-throttle';

type PlaceInfo = {
  placeId: string,
  name: string,
  address: string,
};

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}

const throttle = pThrottle({
  limit: 10, interval: 1250, strict: true,
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

type LocationInputProps = {
  handleInput: (value: string) => void;
  defaultValue: string;
};

export default function LocationInput(
  { handleInput, defaultValue }: LocationInputProps,
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
  const ref = useOnclickOutside(() => {
    // When user clicks outside of the component, we can dismiss
    // the searched suggestions by calling this method
    clearSuggestions();
  });

  const handleOnChange = ({ target }: ChangeEvent<HTMLInputElement>): void => {
    // Update the keyword of the input element
    setValue(target.value);
    // Handle the user selecting a valid value.
    const match = placeDetails.filter(({ address }) => (address === target.value));
    if (match.length === 1) {
      clearSuggestions();
      handleInput(match[0].address);
    }
  };
  const renderSuggestions = () => placeDetails.map(({
    placeId, name, address,
  }) => (<option key={placeId} value={address}>{name}</option>));

  useEffect(() => {
    const fetchDetails = async () => {
      const results = (await Promise.all(data.map(getPlaceInfo))).filter(notEmpty);
      setPlaceDetails(results);
    };
    const _ = fetchDetails();
  }, [data]);

  return (
    <div className="col-10 col-sm-12" ref={ref}>
      <input
        className="form-input"
        type="text"
        id="geo-location"
        placeholder="Nacogdoches, TX"
        value={value}
        onChange={handleOnChange}
        disabled={!ready}
        list="autocomplete-data"
      />
      {/* We can use the 'status' to decide whether we should display the dropdown or not */}
      <datalist id="autocomplete-data">{status === 'OK' && renderSuggestions()}</datalist>
    </div>
  );
}