const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
export const FOLDER_TYPE = 'application/vnd.google-apps.folder'
// Até aqui, uma requisição só; acima, uma sessão de envio (precisa do Location).
export const SIMPLE_UPLOAD_LIMIT = 5 * 1024 * 1024

export interface DriveFileRef {
  id: string
  version: string
}

export interface NewDriveFile {
  name: string
  parentId: string
  mimeType: string
  appProperties?: Record<string, string>
}

// O que a sincronização precisa do Drive: uma interface, para os testes
// rodarem contra um Drive em memória (fake-drive.ts).
export interface DriveApi {
  findFolder(name: string, parentId: string): Promise<string | null>
  createFolder(name: string, parentId: string): Promise<string>
  isFolderAlive(id: string): Promise<boolean>
  findFile(name: string, parentId: string): Promise<DriveFileRef | null>
  findBookFile(bookId: string, parentId: string): Promise<string | null>
  getVersion(id: string): Promise<string>
  createFile(file: NewDriveFile, content: Uint8Array): Promise<DriveFileRef>
  updateFile(id: string, content: Uint8Array, mimeType: string): Promise<DriveFileRef>
  downloadText(id: string): Promise<string>
  downloadBytes(id: string): Promise<Uint8Array>
}

export class DriveApiError extends Error {
  readonly status: number
  // O nome que o Drive dá ao problema, por exemplo storageQuotaExceeded.
  readonly reason: string | null

  constructor(status: number, reason: string | null, message: string) {
    super(message)
    this.name = 'DriveApiError'
    this.status = status
    this.reason = reason
  }
}

export function isDriveApiError(error: unknown): error is DriveApiError {
  return error instanceof Error && error.name === 'DriveApiError'
}

export interface FetchInit {
  method?: string
  headers?: Record<string, string>
  body?: string | Uint8Array
}

export interface FetchResponse {
  ok: boolean
  status: number
  statusText: string
  headers: { get(name: string): string | null }
  json(): Promise<unknown>
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
}

export type FetchLike = (url: string, init?: FetchInit) => Promise<FetchResponse>

export interface DriveApiDeps {
  fetch: FetchLike
  getToken(): Promise<string>
  invalidateToken(): void
  log?(event: string, detail: string): void
}

// A linguagem de consulta do Drive usa aspas simples e escapa com \.
function quote(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function concat(parts: (string | Uint8Array)[]): Uint8Array {
  const encoder = new TextEncoder()
  const chunks = parts.map((part) => (typeof part === 'string' ? encoder.encode(part) : part))
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

export function createDriveApi(deps: DriveApiDeps): DriveApi {
  const log = deps.log ?? (() => {})

  async function errorFrom(method: string, url: string, response: FetchResponse): Promise<DriveApiError> {
    const data = (await response.json().catch(() => null)) as {
      error?: { message?: string; errors?: { reason?: string }[] }
    } | null
    const reason = data?.error?.errors?.[0]?.reason ?? null
    const message = data?.error?.message ?? response.statusText
    log('drive api: erro', `${method} ${url.split('?')[0]} ${response.status} ${reason ?? '-'} ${message}`)
    return new DriveApiError(response.status, reason, `Google Drive ${response.status}: ${message}`)
  }

  async function driveFetch(url: string, init: FetchInit = {}, retried = false): Promise<FetchResponse> {
    const headers = { ...init.headers, Authorization: `Bearer ${await deps.getToken()}` }
    const response = await deps.fetch(url, { ...init, headers })
    if (response.status === 401 && !retried) {
      deps.invalidateToken()
      return driveFetch(url, init, true)
    }
    if (!response.ok) throw await errorFrom(init.method ?? 'GET', url, response)
    return response
  }

  async function listFiles(q: string, fields: string): Promise<{ id: string; version?: string | number }[]> {
    const params = new URLSearchParams({ q, fields: `files(${fields})`, orderBy: 'createdTime', pageSize: '10' })
    const data = (await (await driveFetch(`${API}/files?${params}`)).json()) as {
      files?: { id: string; version?: string | number }[]
    }
    return data.files ?? []
  }

  async function fileRef(response: FetchResponse): Promise<DriveFileRef> {
    const data = (await response.json()) as { id: string; version: string | number }
    return { id: data.id, version: String(data.version) }
  }

  async function upload(
    method: 'POST' | 'PATCH',
    path: string,
    metadata: object,
    content: Uint8Array,
    type: string,
  ): Promise<DriveFileRef> {
    if (content.length <= SIMPLE_UPLOAD_LIMIT) {
      const boundary = `ebooks-${Math.random().toString(36).slice(2)}`
      const body = concat([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
        `--${boundary}\r\nContent-Type: ${type}\r\n\r\n`,
        content,
        `\r\n--${boundary}--`,
      ])
      const response = await driveFetch(`${UPLOAD}${path}?uploadType=multipart&fields=id,version`, {
        method,
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      })
      return fileRef(response)
    }
    const start = await driveFetch(`${UPLOAD}${path}?uploadType=resumable&fields=id,version`, {
      method,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': type,
        'X-Upload-Content-Length': String(content.length),
      },
      body: JSON.stringify(metadata),
    })
    const session = start.headers.get('Location')
    if (!session) {
      log('drive api: envio grande sem Location', `${method} ${path} ${content.length} bytes`)
      throw new DriveApiError(0, 'noUploadSession', 'O Google Drive não devolveu o endereço do envio')
    }
    return fileRef(await driveFetch(session, { method: 'PUT', headers: { 'Content-Type': type }, body: content }))
  }

  return {
    async findFolder(name, parentId) {
      const q = `name = ${quote(name)} and mimeType = '${FOLDER_TYPE}' and ${quote(parentId)} in parents and trashed = false`
      return (await listFiles(q, 'id'))[0]?.id ?? null
    },
    async createFolder(name, parentId) {
      const response = await driveFetch(`${API}/files?fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ name, mimeType: FOLDER_TYPE, parents: [parentId] }),
      })
      return ((await response.json()) as { id: string }).id
    },
    async isFolderAlive(id) {
      try {
        const response = await driveFetch(`${API}/files/${encodeURIComponent(id)}?fields=id,trashed`)
        return !((await response.json()) as { trashed?: boolean }).trashed
      } catch (error) {
        if (isDriveApiError(error) && error.status === 404) return false
        throw error
      }
    },
    async findFile(name, parentId) {
      const q = `name = ${quote(name)} and ${quote(parentId)} in parents and trashed = false`
      const file = (await listFiles(q, 'id,version'))[0]
      return file ? { id: file.id, version: String(file.version) } : null
    },
    async findBookFile(bookId, parentId) {
      const q = `appProperties has { key='bookId' and value=${quote(bookId)} } and ${quote(parentId)} in parents and trashed = false`
      return (await listFiles(q, 'id'))[0]?.id ?? null
    },
    async getVersion(id) {
      const response = await driveFetch(`${API}/files/${encodeURIComponent(id)}?fields=version`)
      return String(((await response.json()) as { version: string | number }).version)
    },
    createFile(file, content) {
      const metadata = {
        name: file.name,
        mimeType: file.mimeType,
        parents: [file.parentId],
        appProperties: file.appProperties,
      }
      return upload('POST', '/files', metadata, content, file.mimeType)
    },
    updateFile(id, content, mimeType) {
      return upload('PATCH', `/files/${encodeURIComponent(id)}`, {}, content, mimeType)
    },
    async downloadText(id) {
      return (await driveFetch(`${API}/files/${encodeURIComponent(id)}?alt=media`)).text()
    },
    async downloadBytes(id) {
      return new Uint8Array(await (await driveFetch(`${API}/files/${encodeURIComponent(id)}?alt=media`)).arrayBuffer())
    },
  }
}
