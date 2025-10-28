const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function handleResponse(response) {
  if (!response.ok) {
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (err) {
      payload = { error: text || 'request failed' };
    }
    const error = new Error(payload.error || response.statusText);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return response.json();
}

export async function apiGet(path, params) {
  const url = new URL(path, BASE);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });
  }
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' }
  });
  return handleResponse(response);
}

export async function apiPost(path, body) {
  const url = new URL(path, BASE);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return handleResponse(response);
}

export { BASE };
