const BASE = '/api/v1/sim'

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  return res.json()
}

export function queueCases() {
  return request('/queue_cases')
}

export function addCase(body) {
  return request('/add_case', { method: 'POST', body: JSON.stringify(body) })
}

export function updateCase(id, body) {
  return request(`/update_case/${id}`, { method: 'PUT', body: JSON.stringify(body) })
}

export function queueModelInfo() {
  return request('/queue_model_info', { method: 'POST' })
}

export function queueDisturbances() {
  return request('/queue_disturbances')
}

export function getDisturbanceInfo(filePath) {
  return request('/get_disturbance_info', {
    method: 'POST',
    body: JSON.stringify({ file_path: filePath }),
  })
}
