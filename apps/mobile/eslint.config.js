// Checked in explicitly so `expo lint` never tries to fetch a config at run
// time — that fails behind a proxy and in CI.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
  },
]);
