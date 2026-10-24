import * as Brightness from 'expo-brightness'
import { useEffect } from 'react'
import { brightnessLevels } from '@/lib/brightness'
import { useThemeStore } from '@/store/theme-store'

// Só a janela do app: ao sair dele, o Android volta ao brilho do sistema sozinho.
export function useAppBrightness() {
  const brightness = useThemeStore((s) => s.brightnessPreview ?? s.brightness)
  useEffect(() => {
    const apply =
      brightness === null
        ? Brightness.restoreSystemBrightnessAsync()
        : Brightness.setBrightnessAsync(brightnessLevels(brightness).window)
    apply.catch((error: unknown) => console.warn('Não foi possível ajustar o brilho', error))
  }, [brightness])
}
