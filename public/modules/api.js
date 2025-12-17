/**
 * API 请求模块
 */

export async function fetchQuota() {
  const response = await fetch('/api/quota');
  return response.json();
}

export async function fetchSingleQuota(email) {
  const response = await fetch(`/api/quota/${encodeURIComponent(email)}`);
  return response.json();
}

export async function refreshAccountToken(email) {
  const response = await fetch(`/api/refresh/${encodeURIComponent(email)}`, {
    method: 'POST'
  });
  return response.json();
}

export async function deleteAccountApi(email) {
  const response = await fetch(`/api/accounts/${encodeURIComponent(email)}`, {
    method: 'DELETE'
  });
  return response.json();
}

export async function downloadAccountApi(email) {
  const response = await fetch(`/api/accounts/${encodeURIComponent(email)}/download`);
  return response;
}

export async function uploadAuthApi(content) {
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain'
    },
    body: content
  });
  return response.json();
}

export async function getProxyConfig() {
  const response = await fetch('/api/proxy');
  return response.json();
}

export async function saveProxyConfigApi(config) {
  const response = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  return response.json();
}

export async function testProxyApi(type, url) {
  const response = await fetch('/api/proxy/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, url })
  });
  return response.json();
}
