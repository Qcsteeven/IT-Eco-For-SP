module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier', // отключает конфликты с Prettier
  ],
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    'prettier/prettier': 'error', 
    '@typescript-eslint/no-explicit-any': 'error',
  },
};