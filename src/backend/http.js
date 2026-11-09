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

const pdfFilename = (header, fallback) => {
  const encoded = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = header?.match(/filename="?([^";]+)"?/i)?.[1];
  let name = encoded || plain || fallback;
  if (encoded) {
    try { name = decodeURIComponent(encoded); } catch { name = fallback; }
  }
  name = name.replace(/[/\\\x00-\x1f]/g, '_').trim();
  return name.toLowerCase().endsWith('.pdf') ? name : fallback;
};

export async function requestPdfApi(path, { token, fallbackFilename }) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch { throw new Error('Không kết nối được backend. Hãy kiểm tra Spring Boot đã chạy.'); }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const error = new Error(data?.message || `Không thể tải PDF (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  if (!(response.headers.get('Content-Type') || '').toLowerCase().includes('application/pdf')) {
    throw new Error('Backend không trả về file PDF hợp lệ.');
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error('File PDF trả về đang trống.');
  return { blob, filename: pdfFilename(response.headers.get('Content-Disposition'), fallbackFilename) };
}
