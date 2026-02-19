module.exports = {
  extends: ['expo', '@react-native'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  ignorePatterns: [
    'node_modules/',
    'scripts/',  // scripts 폴더 무시
    'data/',
    '.expo/',
    'tests/',  // tests 폴더 무시 (임시)
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
    // React rules 완화
    'react-hooks/set-state-in-effect': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-floating-promises': 'warn',
    '@typescript-eslint/no-misused-promises': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-argument': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    'react-native/no-inline-styles': 'warn',
  },
};
