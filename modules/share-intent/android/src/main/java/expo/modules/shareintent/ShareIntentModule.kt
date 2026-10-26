package expo.modules.shareintent

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.lang.ref.WeakReference
import java.util.UUID
import java.util.concurrent.CopyOnWriteArraySet

class ShareIntentModule : Module() {
  companion object {
    private const val FOLDER = "shared"

    // O intent chega pela Activity, às vezes antes de o JS existir: os arquivos
    // esperam aqui até o JS pedir.
    private val pending = mutableListOf<Uri>()
    // A Activity avisa na thread principal; o JS entra e sai na thread do módulo.
    private val observers = CopyOnWriteArraySet<() -> Unit>()

    fun receive(uris: List<Uri>) {
      if (uris.isEmpty()) return
      synchronized(pending) { pending.addAll(uris) }
      observers.forEach { it() }
    }
  }

  private var observer: (() -> Unit)? = null

  override fun definition() = ModuleDefinition {
    Name("ShareIntent")

    Events("onShare")

    // Cópias de uma importação interrompida (app fechado, JS recarregado): nessa
    // hora nenhuma importação está em andamento.
    OnCreate {
      appContext.reactContext?.let { File(it.cacheDir, FOLDER).deleteRecursively() }
    }

    // Copia para o cache já: a permissão de leitura que o outro app deu ao
    // content:// é temporária. Cada arquivo sai da fila ao ser entregue, então
    // um recarregamento do JS não importa de novo.
    AsyncFunction("consume") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val uris = synchronized(pending) { pending.toList().also { pending.clear() } }
      val folder = File(context.cacheDir, FOLDER).apply { mkdirs() }
      uris.map { uri ->
        val name = displayName(context, uri)
        val target = File(folder, UUID.randomUUID().toString())
        val copy = try {
          val input = context.contentResolver.openInputStream(uri) ?: error("Sem conteúdo")
          input.use { source -> target.outputStream().use { source.copyTo(it) } }
          target
        } catch (error: Exception) {
          target.delete()
          null
        }
        mapOf("uri" to copy?.let { Uri.fromFile(it).toString() }, "name" to name)
      }
    }

    OnStartObserving("onShare") {
      val weakModule = WeakReference(this@ShareIntentModule)
      val current = { weakModule.get()?.sendEvent("onShare") ?: Unit }
      observers.add(current)
      observer = current
    }

    OnStopObserving("onShare") {
      observer?.let { observers.remove(it) }
    }
  }

  private fun displayName(context: Context, uri: Uri): String {
    val fromProvider = try {
      context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0) else null
      }
    } catch (error: Exception) {
      null
    }
    return fromProvider ?: uri.lastPathSegment?.substringAfterLast('/') ?: "arquivo"
  }
}
