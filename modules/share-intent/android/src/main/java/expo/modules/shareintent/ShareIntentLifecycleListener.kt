package expo.modules.shareintent

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.core.content.IntentCompat
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class ShareIntentLifecycleListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
    // Reaberto pelos Recentes, o Android repete o intent original, já importado e
    // com a permissão de leitura vencida.
    val intent = activity?.intent ?: return
    if ((intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return
    ShareIntentModule.receive(urisOf(intent))
  }

  override fun onNewIntent(intent: Intent?): Boolean {
    val uris = urisOf(intent)
    ShareIntentModule.receive(uris)
    return uris.isNotEmpty()
  }

  private fun urisOf(intent: Intent?): List<Uri> = when (intent?.action) {
    Intent.ACTION_SEND -> listOfNotNull(IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java))
    Intent.ACTION_SEND_MULTIPLE ->
      IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
    // O VIEW também chega para os links do app (ebooks://): só os arquivos interessam aqui.
    Intent.ACTION_VIEW -> listOfNotNull(intent.data?.takeIf { it.scheme == "content" || it.scheme == "file" })
    else -> emptyList()
  }
}
