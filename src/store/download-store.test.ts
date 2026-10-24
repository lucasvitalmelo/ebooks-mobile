import { createDownloadStore } from './download-store'

const book = { id: 'a', title: 'Livro' } as never

test('baixa, sobe a revisão e libera', async () => {
  const store = createDownloadStore({ download: async () => {}, notify: () => {} })
  await store.getState().download({} as never, book)
  expect(store.getState()).toMatchObject({ downloading: [], revision: 1 })
})

test('o botão e o leitor pedindo o mesmo livro viram um download só', async () => {
  let calls = 0
  let finish: () => void = () => {}
  const store = createDownloadStore({
    download: () => {
      calls++
      return new Promise<void>((resolve) => (finish = resolve))
    },
    notify: () => {},
  })
  const fromButton = store.getState().download({} as never, book)
  const fromReader = store.getState().ensure({} as never, book)
  expect(store.getState().downloading).toEqual(['a'])
  finish()
  await Promise.all([fromButton, fromReader])
  expect(calls).toBe(1)
  expect(store.getState()).toMatchObject({ downloading: [], revision: 1 })
})

test('ensure lança a falha para quem chamou, sem avisar', async () => {
  const notices: string[] = []
  const store = createDownloadStore({
    download: async () => Promise.reject(new Error('x')),
    notify: (text) => notices.push(text),
  })
  await expect(store.getState().ensure({} as never, book)).rejects.toThrow('x')
  expect(notices).toEqual([])
  expect(store.getState().downloading).toEqual([])
})

test('falha avisa com o motivo', async () => {
  const notices: string[] = []
  const store = createDownloadStore({
    download: async () => Promise.reject(new TypeError('Network request failed')),
    notify: (text) => notices.push(text),
  })
  await store.getState().download({} as never, book)
  expect(notices).toEqual(['Não foi possível baixar "Livro". Sem conexão com a internet.'])
  expect(store.getState().revision).toBe(0)
})
