import { requireOptionalNativeModule, type NativeModule } from 'expo'

// `uri` nulo: o arquivo chegou, mas não deu para lê-lo.
export interface SharedFile {
  uri: string | null
  name: string
}

declare class ShareIntentModule extends NativeModule<{ onShare(): void }> {
  consume(): Promise<SharedFile[]>
}

// Opcional: o módulo não existe no Expo Go nem fora do Android.
export default requireOptionalNativeModule<ShareIntentModule>('ShareIntent')
