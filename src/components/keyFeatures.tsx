import React from 'react';

import styles from './styles.module.css';

type KeyFeaturesProps = {
  features: Array<string>,
};

function KeyFeatures({ features } : KeyFeaturesProps) :React.Component {
  return (
    <>
      <p>Key Features</p>
      <ul className={styles.list}>
        {features.map((feature) => (
          <li key={feature}>
            <small>{feature}</small>
          </li>
        ))}
      </ul>
    </>
  );
}

export { KeyFeatures };
