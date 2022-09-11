import classnames from 'classnames';
import React, { useEffect, useState } from 'react';
import { useQueryParam } from 'use-query-params';
import {
  DefaultFetchPropertiesRequest,
  DefaultLocalSettings,
  FetchPropertiesRequest,
  LocalFilterSettings,
  SortOrder,
} from '../common';
import { CUTTLY_API_KEY, urlShortnerEndpoint } from '../constants';
import { CuttlyApiResponse, getJsonResponse } from '../utilities';

import styles from './styles.module.css';

type FilterProps = {
  // Callback to update local state.
  localUpdate: (localSettings: LocalFilterSettings) => void,
  // Callback to update remote state (need to fetch new properties).
  remoteUpdate: (remoteSettings: FetchPropertiesRequest) => void,
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

export default function Filter({ remoteUpdate, localUpdate }: FilterProps) {
  const [shareUrl, setShareUrl] = useState<null | string>(null);
  const [remoteForm, setRemoteForm] = useQueryParam('remote', RemoteParser);
  const [localForm, setLocalForm] = useQueryParam('local', LocalParser);

  const onShareClick = async () => {
    const urlReq = `${urlShortnerEndpoint}?key=${CUTTLY_API_KEY}&short=${encodeURIComponent(window.location.href)}`;
    const { url } = await getJsonResponse(urlReq, 'json', true) as CuttlyApiResponse;
    if (url.status === 7) {
      await navigator.clipboard.writeText(url.shortLink);
      setShareUrl(url.shortLink);
    }
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
    setShareUrl(null);
  }, [remoteForm, localForm]);

  const containerClasses = classnames('container', 'mb-1', styles.container);
  const formClasses = classnames('form-horizontal', styles.form);
  return (
    <div className={containerClasses}>
      <form
        className={formClasses}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          remoteUpdate(remoteForm);
        }}
      >
        <p className="mb-1">Refine your results</p>
        <div className="columns text-center">
          <div className="column col-3 col-xs-12">
            <div className="form-group">
              <div className="col-3 col-sm-12">
                <label className="form-label" htmlFor="geo-location">
                  Location
                </label>
              </div>
              <div className="col-9 col-sm-12">
                <input
                  className="form-input"
                  type="text"
                  id="geo-location"
                  placeholder="Nacogdoches, TX"
                  value={remoteForm.geoLocation}
                  onChange={(event) => setRemoteForm((latestForm: FetchPropertiesRequest) => ({
                    ...latestForm,
                    geoLocation: event.target.value,
                  }))}
                />
              </div>
            </div>
          </div>
          <div className="column col-2 col-xs-5">
            <div className="form-group">
              <div className="col-6 col-sm-12">
                <label className="form-label" htmlFor="radius">
                  Radius (Miles)
                </label>
              </div>
              <div className="col-4 col-sm-12">
                <input
                  className="form-input"
                  min="1"
                  max="50"
                  type="number"
                  id="radius"
                  placeholder="15"
                  value={remoteForm.radius}
                  onChange={(event) => setRemoteForm((latestForm: FetchPropertiesRequest) => ({
                    ...latestForm,
                    radius: Number(event.target.value),
                  }))}
                />
              </div>
            </div>
          </div>
          <div className="column col-2 col-xs-12">
            <div className="form-group">
              <div className="col-3 col-sm-12">
                <label className="form-label" htmlFor="price-from">
                  Price from
                </label>
              </div>
              <div className="col-8 col-sm-12">
                <input
                  className="form-input"
                  min="0"
                  max="10000000"
                  type="number"
                  id="price-from"
                  placeholder="£1,000,000"
                  value={remoteForm.priceFrom || ''}
                  onChange={(event) => setRemoteForm((latestForm: FetchPropertiesRequest) => ({
                    ...latestForm,
                    priceFrom: Number(event.target.value),
                  }))}
                />
              </div>
            </div>
          </div>
          <div className="column col-2 col-xs-12">
            <div className="form-group">
              <div className="col-3 col-sm-12">
                <label className="form-label" htmlFor="price-most">
                  Price At Most
                </label>
              </div>
              <div className="col-8 col-sm-12">
                <input
                  className="form-input"
                  min="0"
                  max="10000000"
                  type="number"
                  id="price-most"
                  placeholder="£1,000,000"
                  value={remoteForm.priceMost || ''}
                  onChange={(event) => setRemoteForm((latestForm: FetchPropertiesRequest) => ({
                    ...latestForm,
                    priceMost: Number(event.target.value),
                  }))}
                />
              </div>
            </div>
          </div>
          <div className="column col-2 col-xs-12">
            <div className="form-group">
              <div className="col-3 col-sm-12">
                <label className="form-label" htmlFor="sortorder">
                  Sort Order
                </label>
              </div>
              <div className="col-8 col-sm-12">
                <select
                  className="form-select"
                  id="sortorder"
                  value={localForm.sortOrder}
                  onChange={(event) => setLocalForm((latestForm: LocalFilterSettings) => ({
                    ...latestForm,
                    sortOrder: event.target.value as SortOrder,
                  }))}
                >
                  {localForm.sortOrders.map((order) => (
                    <option key={order} value={order.replace(' ', '').toLowerCase()}>
                      {order}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="column col-2 col-xs-5">
            <div className="form-group">
              <div className="col-6 col-sm-12">
                <label className="form-label" htmlFor="meets-rule">
                  Price:Rent Ratio
                </label>
              </div>
              <div className="col-4 col-sm-12">
                <input
                  className="form-input"
                  min="0"
                  max="100"
                  type="number"
                  step="0.1"
                  id="meets-rule"
                  placeholder="1.5"
                  value={localForm.meetsRule || ''}
                  onChange={(event) => setLocalForm((latestForm: LocalFilterSettings) => ({
                    ...latestForm,
                    meetsRule: Number(event.target.value),
                  }))}
                />
              </div>
            </div>
          </div>
          <div className="column col-2 col-xs-5">
            <div className="form-group">
              <div className="col-10 col-sm-12">
                <label className="form-label" htmlFor="only-rent">
                  Only If Rent Estimate Available
                </label>
              </div>
              <div className="col-4 col-sm-12">
                <input
                  type="checkbox"
                  id="only-rent"
                  checked={localForm.rentOnly}
                  onChange={(event) => setLocalForm((latestForm: LocalFilterSettings) => ({
                    ...latestForm,
                    rentOnly: event.target.checked,
                  }))}
                />
              </div>
            </div>
          </div>
          <div className="column col-2 col-xs-5">
            <div className="form-group">
              <div className="col-10 col-sm-12">
                <label className="form-label" htmlFor="only-rent">
                  Only New Construction
                </label>
              </div>
              <div className="col-4 col-sm-12">
                <input
                  type="checkbox"
                  id="only-new-construction"
                  checked={localForm.newConstruction}
                  onChange={(event) => setLocalForm((latestForm: LocalFilterSettings) => ({
                    ...latestForm,
                    newConstruction: event.target.checked,
                  }))}
                />
              </div>
            </div>
          </div>
          <div className="column col-2 col-xs-5">
            <div className="form-group">
              <div className="col-10 col-sm-12">
                <label className="form-label" htmlFor="only-rent">
                  Include Land
                </label>
              </div>
              <div className="col-4 col-sm-12">
                <input
                  type="checkbox"
                  id="only-rent"
                  checked={localForm.includeLand}
                  onChange={(event) => setLocalForm((latestForm: LocalFilterSettings) => ({
                    ...latestForm,
                    includeLand: event.target.checked,
                  }))}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="columns text-center">
          <div className="column col-2 col-xs-5">
            <input type="submit" value="Submit" />
          </div>
          <div className="column col-2 col-xs-5">
            { (shareUrl)
              ? (
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                />
              )
              : (
                <input
                  type="button"
                  value="Share"
                  onClick={() => {
                    const _ = (async () => {
                      await onShareClick();
                    })();
                  }}
                />
              )}
          </div>
        </div>
      </form>
    </div>
  );
}
