import type * as SignInModule from '@react-native-google-signin/google-signin'
import { DriveAuthError } from './auth-error'

// Só os arquivos que o app criou (o mesmo escopo do leitor web, no mesmo
// projeto do Google Cloud: o "app" do drive.file é o projeto, então este
// cliente Android enxerga a pasta MyBooks que o web criou).
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export interface DriveAccount {
  email: string
  name: string | null
}

let signIn: typeof SignInModule | null | undefined

// Carregado no primeiro uso: no Expo Go o módulo nativo não existe, e importar
// direto derrubaria o app na abertura. Lá o Drive fica indisponível.
function load(): typeof SignInModule {
  if (signIn === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      signIn = require('@react-native-google-signin/google-signin') as typeof SignInModule
      signIn.GoogleSignin.configure({ scopes: [DRIVE_SCOPE] })
    } catch (error) {
      console.warn('Google Sign-In indisponível (Expo Go?)', error)
      signIn = null
    }
  }
  if (!signIn) throw new DriveAuthError('indisponivel', 'O Google Drive só funciona no APK.')
  return signIn
}

let cached: string | null = null
let clearing: Promise<void> | null = null

function accountOf(user: { email: string; name: string | null }): DriveAccount {
  return { email: user.email, name: user.name }
}

export function currentAccount(): DriveAccount | null {
  if (!signIn) return null
  const current = signIn.GoogleSignin.getCurrentUser()
  return current ? accountOf(current.user) : null
}

// Sem login guardado: desconectado. O Google recusou o login guardado (senha
// trocada, acesso revogado na conta): reconectar. O resto (sem rede, sem Play
// Services, Expo Go): indisponível.
function toAuthError(error: unknown): DriveAuthError {
  if (error instanceof DriveAuthError) return error
  // O código cru do Google: é o que diz, no aparelho, se o acesso foi revogado.
  const raw = error as { code?: unknown; message?: unknown } | null
  console.warn('Google Sign-In falhou', raw?.code ?? '-', raw?.message ?? String(error))
  if (signIn?.isErrorWithCode(error) && error.code === signIn.statusCodes.SIGN_IN_REQUIRED) {
    return new DriveAuthError('reconectar', 'Conecte o Google Drive de novo.')
  }
  return new DriveAuthError('indisponivel', 'Sem conexão com o Google.')
}

export async function getAccessToken(): Promise<string> {
  // Um token recusado ainda sendo esquecido pelo Android viria de novo no getTokens.
  if (clearing) await clearing
  if (cached) return cached
  try {
    const { GoogleSignin, isNoSavedCredentialFoundResponse } = load()
    if (!GoogleSignin.getCurrentUser()) {
      const silent = await GoogleSignin.signInSilently()
      if (isNoSavedCredentialFoundResponse(silent))
        throw new DriveAuthError('desconectado', 'Google Drive desconectado.')
    }
    if (!GoogleSignin.getCurrentUser()?.scopes.includes(DRIVE_SCOPE)) {
      throw new DriveAuthError('reconectar', 'Conecte o Google Drive de novo.')
    }
    cached = (await GoogleSignin.getTokens()).accessToken
    return cached
  } catch (error) {
    throw toAuthError(error)
  }
}

// Depois de um 401: o Android guarda o token, e só esquecer aqui não basta.
export function invalidateAccessToken(): void {
  if (cached && signIn) {
    const done: Promise<void> = signIn.GoogleSignin.clearCachedAccessToken(cached).then(
      () => {
        if (clearing === done) clearing = null
      },
      () => {
        if (clearing === done) clearing = null
      },
    )
    clearing = done
  }
  cached = null
}

// null: a pessoa fechou a tela de login.
export async function connectDrive(): Promise<DriveAccount | null> {
  try {
    const { GoogleSignin, isSuccessResponse } = load()
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    const result = await GoogleSignin.signIn()
    if (!isSuccessResponse(result)) return null
    if (!result.data.scopes.includes(DRIVE_SCOPE)) {
      // null ou cancelado: a pessoa não deu acesso ao Drive.
      const granted = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] })
      if (!granted || !isSuccessResponse(granted)) return null
    }
    cached = null
    return accountOf(result.data.user)
  } catch (error) {
    throw toAuthError(error)
  }
}

// Só sai da conta neste aparelho. Não revoga no Google: revogar tira o acesso
// do projeto inteiro e desconectaria também o leitor web e os outros aparelhos.
export async function disconnectDrive(): Promise<void> {
  invalidateAccessToken()
  await load().GoogleSignin.signOut()
}
