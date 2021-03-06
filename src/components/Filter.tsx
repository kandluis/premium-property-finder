import classnames from 'classnames';
import {
  DefaultFilter,
  FilterState,
  SortOrder,
} from '../common';
import { CUTTLY_API_KEY, urlShortnerEndpoint } from '../constants';
import React, { useState, useEffect } from 'react';
import { get, getJsonResponse } from '../utilities';

import * as style from "./styles.module.css";

type FilterProps = {
  updateFilter: (filter: FilterState) => void,
  filter: FilterState,
};

function Filter(props: FilterProps) {
  const [form, setForm] = useState<FilterState>(props.filter);
  const [shareUrl, setShareUrl] = useState<null | string>(null);
  const onShareClick = async () => {
    const url = `${urlShortnerEndpoint}?key=${CUTTLY_API_KEY}&short=${window.location.href}`;
    const json = await getJsonResponse(url, 'json', true);
    const shortUrl = get(json, 'url.shortLink') as string | null;
    if (shortUrl) {
      navigator.clipboard.writeText(shortUrl);
    }
    setShareUrl(shortUrl);
  }
  const containerClasses = classnames('container', 'mb-1', style.container);
  const formClasses = classnames('form-horizontal', style.form);
  useEffect(() => {
    props.updateFilter(form);
  }, [form.includeLand, form.meetsRule, form.radius, form.rentOnly, form.newConstruction, form.sortOrder]);
  useEffect(() => {
    setShareUrl(null);
  }, [form])
  return (
    <div className={containerClasses}>
      <form
        className={formClasses}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          props.updateFilter(form);
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
                  value={form.geoLocation}
                  onChange={event => setForm({ ...form, geoLocation: event.target.value })}
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
                  value={form.radius || ''}
                  onChange={event => setForm({ ...form, radius: Number(event.target.value) })}
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
                  value={form.priceFrom || ''}
                  onChange={event => setForm({ ...form, priceFrom: Number(event.target.value) })}
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
                  value={form.priceMost || ''}
                  onChange={event => setForm({ ...form, priceMost: Number(event.target.value) })}
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
                  value={form.sortOrder}
                  onChange={event => setForm({ ...form, sortOrder: event.target.value as SortOrder })}
                >
                  <option>Choose...</option>
                  {form.sortOrders.map(order => (
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
                  value={form.meetsRule || ''}
                  onChange={event => setForm({ ...form, meetsRule: Number(event.target.value) })}
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
                  checked={form.rentOnly}
                  onChange={event => setForm({ ...form, rentOnly: event.target.checked })}
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
                  checked={form.newConstruction}
                  onChange={event => setForm({ ...form, newConstruction: event.target.checked })}
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
                  checked={form.includeLand}
                  onChange={event => setForm({ ...form, includeLand: event.target.checked })}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="columns text-center">
          <div className="column col-2 col-xs-5" >
            <input type="submit" value="Submit" />
          </div>
          <div className="column col-2 col-xs-5" >
            { (shareUrl)
              ? <input
                  type='text'
                  readOnly={true}
                  value={shareUrl}
                />
              : <input type="button" value="Share" onClick={onShareClick} />
            }
          </div>
        </div>
      </form>
    </div>
  )
}

export { Filter };