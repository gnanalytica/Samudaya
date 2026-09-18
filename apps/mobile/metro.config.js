// Sentry's serializer emits the Debug IDs that let a minified stack trace be
// mapped back to our source. Without it the reports still arrive, just
// unreadable. Expo's default config is the base; this only wraps it.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
