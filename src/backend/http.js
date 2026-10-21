const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export async function requestApi(path, { token, method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
  } catch { throw new Error('Không kết nối được backend. Hãy kiểm tra Spring Boot đã chạy.'); }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || `Yêu cầu thất bại (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}
