import { useSettingsStore } from '../store/useSettingsStore';

/**
 * Thrown when the API base URL hasn't been configured yet. Callers can
 * catch this specifically to prompt the user toward Settings rather than
 * showing a generic network-error message.
 */
export class ApiNotConfiguredError extends Error {
  constructor() {
    super('The MFC API URL has not been configured yet.');
    this.name = 'ApiNotConfiguredError';
  }
}

/** Thrown for any response the Apps Script backend itself flagged as an error. */
export class ApiError extends Error {
  constructor(message, context) {
    super(message || 'The request failed.');
    this.name = 'ApiError';
    this.context = context;
  }
}

function getBaseUrl() {
  const url = useSettingsStore.getState().apiBaseUrl;
  if (!url) throw new ApiNotConfiguredError();
  return url;
}

/**
 * Calls a GET-style action on the Apps Script web app (see Code.gs's
 * API_ROUTES table for the full list of valid action names).
 * @param {string} action
 * @param {Record<string, string>} [params] Scalar query params (e.g. supplierName).
 */
export async function apiGet(action, params = {}) {
  const base = getBaseUrl();
  const url = new URL(base);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  });

  if (window.electronAuth && window.electronAuth.apiRequest) {
    return window.electronAuth.apiRequest(url.toString(), 'GET');
  }

  const res = await fetch(url.toString(), {
    method: 'GET'
  });
  return parseResponse(res, action);
}

/**
 * Calls a POST-style action (writes: addOrUpdatePrice, deletePrice,
 * runSnapshotNow) on the Apps Script web app.
 * @param {string} action
 * @param {Record<string, unknown>} [params] Body params, sent under `params`.
 */
export async function apiPost(action, params = {}) {
  const base = getBaseUrl();
  const payload = { action, params };

  if (window.electronAuth && window.electronAuth.apiRequest) {
    return window.electronAuth.apiRequest(base, 'POST', payload);
  }

  const res = await fetch(base, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    // Apps Script web apps don't parse multipart/JSON content-type
    // preflight-free from a browser context reliably, so this is sent as
    // text/plain (a "simple request", avoiding CORS preflight) with a
    // JSON string body — Code.gs's doPost() parses e.postData.contents
    // as JSON regardless of the declared content type.
    body: JSON.stringify(payload)
  });
  return parseResponse(res, action);
}

async function parseResponse(res, action) {
  if (!res.ok) {
    throw new ApiError(`Request failed with status ${res.status}.`, action);
  }
  const data = await res.json();
  if (data && data.error) {
    throw new ApiError(data.message || `The ${action} request failed.`, data.context || action);
  }
  return data;
}

