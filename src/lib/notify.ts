import { ToastAndroid } from 'react-native'

export function notify(text: string): void {
  ToastAndroid.show(text, ToastAndroid.SHORT)
}
