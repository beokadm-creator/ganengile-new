module.exports = {
  extends: ['expo', '@react-native'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  ignorePatterns: [
    'node_modules/',
    'scripts/',  // scripts 폴더 무시
    'data/',
    '.expo/',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'no-console': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-undef': 'off',  // Node.js 환경에서 require/module 허용
  },
};
