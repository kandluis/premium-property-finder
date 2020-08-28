module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'airbnb',
  ],
  parserOptions: {
    project: './tsconfig.json',
  },
  plugins: [
    '@typescript-eslint'
  ],
  root: true,
}
