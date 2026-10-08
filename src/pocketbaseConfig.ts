// Both frontends use the same build; the deployed hostname selects the API.
export const pocketBaseUrl = window.location.hostname === 'dev.methric.ch'
  ? 'https://api-dev.methric.ch'
  : 'https://api.methric.ch';
