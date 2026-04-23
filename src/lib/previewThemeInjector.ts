import type { SavedCustomTheme } from '@/types'

export function injectCustomTheme(theme: SavedCustomTheme): void {
  const styleId = `preview-theme-custom-${theme.id}`
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null

  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = styleId
    document.head.appendChild(styleEl)
  }

  const c = theme.colors
  styleEl.textContent = `
    .markdown-preview[data-preview-theme="${theme.id}"] {
      --preview-bg: ${c.previewBgLight};
    }
    .markdown-preview[data-preview-theme="${theme.id}"] .mk-body {
      --preview-accent: ${c.accent};
      --preview-accent-hover: ${c.accent};
      --preview-accent-red: ${c.accentRed};
      --preview-accent-green: ${c.accentGreen};
      --preview-accent-amber: ${c.accentAmber};
      --preview-accent-purple: ${c.accentPurple};
      --preview-text-link: ${c.textLink};
      --preview-text-link-hover: ${c.textLinkHover};
      --preview-border-accent: ${c.borderAccent};
    }
    [data-theme="dark"] .markdown-preview[data-preview-theme="${theme.id}"] {
      --preview-bg: ${c.previewBgDark};
    }
  `
}

export function removeCustomTheme(themeId: string): void {
  const styleEl = document.getElementById(`preview-theme-custom-${themeId}`)
  if (styleEl) {
    styleEl.remove()
  }
}
