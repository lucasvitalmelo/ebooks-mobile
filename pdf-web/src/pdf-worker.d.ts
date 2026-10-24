// O pdfjs-dist não traz tipos para o worker; só o WorkerMessageHandler é usado.
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown
}
