// Vite replaces MODE at build time. Local development uses the dev API too.
export const pocketBaseUrl = import.meta.env.MODE === 'production'
  ? 'https://api.methric.ch'
  : 'https://api-dev.methric.ch';
