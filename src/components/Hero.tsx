import React from 'react';

import classnames, { Argument } from 'classnames';
import styles from './styles.module.css';

export default function Hero(): React.ReactElement {
  const classes = classnames('hero', 'hero-lg', 'mb-3', styles.hero as Argument);
  return (
    <div className={classes}>
      <div className="hero-body text-center text-light">
        <h1>Premium Property Finder</h1>
        <p className="mb-0">Bringing premium property right to your fingertips</p>
      </div>
    </div>
  );
}
