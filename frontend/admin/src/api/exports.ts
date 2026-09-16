/** 資料匯出 API */
import { api, http } from './client'
import type { ExportKind, ExportLogOut, ExportParams } from './types'

export function fetchExportHistory() {
  return http.get<ExportLogOut[]>('/admin/exports/history')
}

/** 產生並直接下載檔案（同時在後端寫入匯出歷史） */
export async function runExport(kind: ExportKind, params: ExportParams = {}) {
  const query: Record<string, unknown> = {}
  if (params.division_id) query.division_id = params.division_id
  if (params.round_id) query.round_id = params.round_id
  if (params.anonymous !== undefined) query.anonymous = params.anonymous
  query.format = params.format ?? 'csv'

  const res = await api.post(`/admin/exports/${kind}`, null, {
    params: query,
    responseType: 'blob',
  })
  const filename =
    parseFilename(res.headers['content-disposition'] as string | undefined) ?? `${kind}.${query.format}`
  triggerDownload(res.data as Blob, filename)
  return filename
}

export async function downloadExport(logId: number, filename: string) {
  const res = await api.get(`/admin/exports/download/${logId}`, { responseType: 'blob' })
  triggerDownload(res.data as Blob, filename)
}

function parseFilename(disposition?: string): string | null {
  if (!disposition) return null
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (utf8) return decodeURIComponent(utf8[1])
  const plain = /filename="?([^";]+)"?/i.exec(disposition)
  return plain ? plain[1] : null
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
