// O primeiro relocated depois de abrir é a posição restaurada, e o mesmo CFI de novo
// (a página reenvia a posição quando as locations ficam prontas) não é virar de página.
export function shouldHideBar(lastCfi: string | null, cfi: string): boolean {
  return lastCfi !== null && cfi !== lastCfi
}
