const BASE_URL = import.meta.env.BASE_URL ?? '/';

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) return '/';
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

export function getBaseUrl() {
  return normalizeBaseUrl(BASE_URL);
}

export function resolveRuntimePath(relativePath) {
  const normalizedBaseUrl = getBaseUrl();
  const normalizedPath = String(relativePath ?? '').replace(/^\/+/, '');
  return `${normalizedBaseUrl}${normalizedPath}`;
}
