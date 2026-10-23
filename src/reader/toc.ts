export interface TocEntry {
  label: string
  href: string
  depth: number
}

interface NavItem {
  label: string
  href: string
  subitems?: NavItem[]
}

export function flattenToc(items: NavItem[], depth = 0): TocEntry[] {
  return items.flatMap((item) => [
    { label: item.label.trim(), href: item.href, depth },
    ...flattenToc(item.subitems ?? [], depth + 1),
  ])
}

const fileOf = (href: string) => href.split('#')[0].replace(/^\.\//, '')

export function currentEntry(entries: TocEntry[], href: string | null): number {
  if (!href) return -1
  const file = fileOf(href)
  return entries.findIndex((entry) => fileOf(entry.href) === file)
}
