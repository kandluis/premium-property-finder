module.exports = {
  env: {
    browser: true,
    es2020: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'airbnb',
    'airbnb/hooks',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
      modules: true
    },
    ecmaVersion: 11,
    project: './tsconfig.json',
    sourceType: 'module'
  },
  plugins: [
    'react',
    'react-hooks',
    '@typescript-eslint'
  ],
  settings: {
    react: { version: 'detect' }
  },
  rules: {
    'no-console': 'off',
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        'js': 'never',
        'jsx': 'never',
        'ts': 'never',
        'tsx': 'never'
      }
    ],
    'react/jsx-filename-extension': [
      2, {
        'extensions': ['.js', '.jsx', '.ts', '.tsx'] 
      }
    ]
  }
}
