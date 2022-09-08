import React from 'react';

import classnames from 'classnames';
import * as style from './styles.module.css';

function Hero(): React.ReactElement {
  const classes = classnames('hero', 'hero-lg', 'mb-3', style.hero);
  return (
    <div className={classes}>
      <div className="hero-body text-center text-light">
        <h1>Premium Property Finder</h1>
        <p className="mb-0">Bringing premium property right to your fingertips</p>
      </div>
    </div>
  );
}

export { Hero };
