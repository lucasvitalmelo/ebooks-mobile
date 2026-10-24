// A entrada que o epub.js usa; importar a mesma evita um segundo JSZip no bundle.
declare module 'jszip/dist/jszip' {
  import JSZip from 'jszip'
  export default JSZip
}
