import { createDriveApi, DriveApiError, SIMPLE_UPLOAD_LIMIT, type FetchLike } from './api'

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body?: string | Uint8Array
}

function response(status: number, body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => JSON.parse(text),
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer,
  }
}

function setup(answers: ReturnType<typeof response>[]) {
  const calls: Call[] = []
  const fetch: FetchLike = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body })
    const next = answers.shift()
    if (!next) throw new Error(`resposta não prevista para ${url}`)
    return next
  }
  let tokens = 0
  const invalidated: number[] = []
  const api = createDriveApi({
    fetch,
    getToken: async () => `token-${++tokens}`,
    invalidateToken: () => invalidated.push(tokens),
  })
  return { api, calls, invalidated }
}

test('procura pasta com a consulta do web e o token', async () => {
  const { api, calls } = setup([response(200, { files: [{ id: 'p1' }] })])
  expect(await api.findFolder("Livro's", 'root')).toBe('p1')
  const url = new URL(calls[0].url)
  expect(url.pathname).toBe('/drive/v3/files')
  expect(url.searchParams.get('q')).toBe(
    "name = 'Livro\\'s' and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents and trashed = false",
  )
  expect(calls[0].headers.Authorization).toBe('Bearer token-1')
})

test('acha o livro pela appProperty bookId', async () => {
  const { api, calls } = setup([response(200, { files: [] })])
  expect(await api.findBookFile('abc', 'p1')).toBeNull()
  expect(new URL(calls[0].url).searchParams.get('q')).toBe(
    "appProperties has { key='bookId' and value='abc' } and 'p1' in parents and trashed = false",
  )
})

test('401 troca o token uma vez e repete', async () => {
  const { api, calls, invalidated } = setup([response(401, {}), response(200, { version: '7' })])
  expect(await api.getVersion('f')).toBe('7')
  expect(invalidated).toEqual([1])
  expect(calls[1].headers.Authorization).toBe('Bearer token-2')
})

test('erro do Drive vira DriveApiError com o motivo', async () => {
  const { api } = setup([response(403, { error: { message: 'cheio', errors: [{ reason: 'storageQuotaExceeded' }] } })])
  const error = await api.getVersion('f').catch((e: unknown) => e)
  expect(error).toBeInstanceOf(DriveApiError)
  expect(error).toMatchObject({ status: 403, reason: 'storageQuotaExceeded' })
})

test('arquivo pequeno sobe numa requisição multipart', async () => {
  const { api, calls } = setup([response(200, { id: 'n1', version: 3 })])
  const ref = await api.createFile(
    { name: 'a.json', parentId: 'd', mimeType: 'application/json', appProperties: { bookId: 'x' } },
    new TextEncoder().encode('{}'),
  )
  expect(ref).toEqual({ id: 'n1', version: '3' })
  expect(calls[0].url).toContain('/upload/drive/v3/files?uploadType=multipart')
  const body = new TextDecoder().decode(calls[0].body as Uint8Array)
  expect(body).toContain('"parents":["d"]')
  expect(body).toContain('"appProperties":{"bookId":"x"}')
  expect(body).toContain('Content-Type: application/json\r\n\r\n{}')
})

test('arquivo grande abre uma sessão e manda o conteúdo para o Location', async () => {
  const { api, calls } = setup([
    response(200, '', { location: 'https://upload.example/sessao' }),
    response(200, { id: 'big', version: 1 }),
  ])
  const content = new Uint8Array(SIMPLE_UPLOAD_LIMIT + 1)
  await api.updateFile('big', content, 'application/epub+zip')
  expect(calls[0].url).toContain('/upload/drive/v3/files/big?uploadType=resumable')
  expect(calls[0].method).toBe('PATCH')
  expect(calls[0].headers['X-Upload-Content-Length']).toBe(String(content.length))
  expect(calls[1]).toMatchObject({ url: 'https://upload.example/sessao', method: 'PUT' })
  expect(calls[1].body).toBe(content)
})

test('baixa bytes e texto', async () => {
  const { api } = setup([response(200, 'abc'), response(200, 'xyz')])
  expect(new TextDecoder().decode(await api.downloadBytes('f'))).toBe('abc')
  expect(await api.downloadText('f')).toBe('xyz')
})
