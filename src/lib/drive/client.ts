import { fetch } from 'expo/fetch'
import { createDriveApi, type FetchLike } from './api'
import { getAccessToken, invalidateAccessToken } from './auth'

// O expo/fetch aceita Uint8Array no corpo e devolve arrayBuffer(), sem passar por Blob.
export const driveApi = createDriveApi({
  fetch: fetch as unknown as FetchLike,
  getToken: getAccessToken,
  invalidateToken: invalidateAccessToken,
  log: (event, detail) => console.log(`[drive] ${event}: ${detail}`),
})
