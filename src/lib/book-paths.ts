export function bookPath(id: string): string {
  return `books/${id}.epub`
}

export function coverPath(id: string, extension: string): string {
  return `covers/${id}.${extension}`
}
