import { Chart as ChartJS } from 'chart.js'

/**
 * Shared chart theme. The categorical order is fixed and validated for colour-vision
 * deficiency (adjacent CVD ΔE ≥ 8, normal-vision ΔE ≥ 15) against the light card (#ffffff)
 * and the dark card (#18181b). Assign slots by entity, never by rank, and fold anything
 * past slot 8 into "Other" instead of generating new hues.
 */
export const CHART_SERIES_LIGHT = ['#3e5bd8', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'] as const
export const CHART_SERIES_DARK = ['#5b78e6', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'] as const

export const CHART_OTHER_LIGHT = '#a1a1aa'
export const CHART_OTHER_DARK = '#52525b'

export const CHART_FONT_FAMILY =
  "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"

export interface ChartChrome {
  text: string
  muted: string
  grid: string
  axis: string
  surface: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
  tooltipMuted: string
}

export function chartChrome(dark: boolean): ChartChrome {
  return dark
    ? {
        text: '#d4d4d8',
        muted: '#a1a1aa',
        grid: '#27272a',
        axis: '#3f3f46',
        surface: '#18181b',
        tooltipBg: '#1c1c20',
        tooltipBorder: '#3f3f46',
        tooltipText: '#fafafa',
        tooltipMuted: '#a1a1aa'
      }
    : {
        text: '#3f3f46',
        muted: '#71717a',
        grid: '#f0f0f2',
        axis: '#d4d4d8',
        surface: '#ffffff',
        tooltipBg: '#ffffff',
        tooltipBorder: '#e4e4e7',
        tooltipText: '#09090b',
        tooltipMuted: '#71717a'
      }
}

export function chartSeries(dark: boolean): readonly string[] {
  return dark ? CHART_SERIES_DARK : CHART_SERIES_LIGHT
}

/** Colour for a series slot; slots past the palette share the neutral "Other" colour. */
export function seriesColor(index: number, dark: boolean): string {
  const palette = chartSeries(dark)
  if (index < 0 || index >= palette.length) return dark ? CHART_OTHER_DARK : CHART_OTHER_LIGHT
  return palette[index]
}

/** Colours for `count` series in slot order; anything past slot 8 folds into "Other". */
export function seriesColors(count: number, dark: boolean): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => seriesColor(index, dark))
}

/** Hex colour with alpha (0-1) for translucent fills. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${a}`
}

/** Tooltip styling shared by every chart. */
export function chartTooltip(dark: boolean) {
  const c = chartChrome(dark)
  return {
    backgroundColor: c.tooltipBg,
    borderColor: c.tooltipBorder,
    borderWidth: 1,
    titleColor: c.tooltipText,
    bodyColor: c.tooltipText,
    footerColor: c.tooltipMuted,
    titleFont: { family: CHART_FONT_FAMILY, size: 12, weight: 600 as const },
    bodyFont: { family: CHART_FONT_FAMILY, size: 12 },
    footerFont: { family: CHART_FONT_FAMILY, size: 11, weight: 400 as const },
    padding: 10,
    cornerRadius: 8,
    boxPadding: 4,
    usePointStyle: true,
    displayColors: true
  }
}

/** Recessive hairline axes: solid grid one shade off the surface, muted ticks. */
export function chartAxis(dark: boolean, extra: Record<string, unknown> = {}) {
  const c = chartChrome(dark)
  return {
    border: { color: c.axis },
    grid: { color: c.grid, drawTicks: false },
    ticks: { color: c.muted, padding: 8, font: { family: CHART_FONT_FAMILY, size: 11 } },
    ...extra
  }
}

/**
 * Category x-axis for date buckets: "YYYY-MM-DD HH:mm" shows as "HH:mm", "YYYY-MM-DD" as "MM-DD",
 * horizontal labels only, thinned automatically instead of rotating into a diagonal wall.
 */
export function chartDateAxis(dark: boolean) {
  const c = chartChrome(dark)
  return chartAxis(dark, {
    grid: { display: false },
    ticks: {
      color: c.muted,
      padding: 8,
      maxRotation: 0,
      autoSkip: true,
      autoSkipPadding: 18,
      font: { family: CHART_FONT_FAMILY, size: 11 },
      callback(this: { getLabelForValue: (value: number) => string }, value: string | number) {
        return compactDateLabel(String(this.getLabelForValue(Number(value))))
      }
    }
  })
}

export function compactDateLabel(label: string): string {
  const hourly = label.match(/^\d{4}-\d{2}-\d{2}[ T](\d{2}:\d{2})/)
  if (hourly) return hourly[1]
  const daily = label.match(/^\d{4}-(\d{2}-\d{2})$/)
  if (daily) return daily[1]
  return label
}

let defaultsApplied = false

/** Apply global Chart.js defaults once (font, colours); safe to call from every chart. */
export function applyChartDefaults() {
  if (defaultsApplied) return
  defaultsApplied = true
  ChartJS.defaults.font.family = CHART_FONT_FAMILY
  ChartJS.defaults.font.size = 11
  ChartJS.defaults.color = '#71717a'
  // defaults.set creates scopes for elements that a given chart has not registered yet.
  ChartJS.defaults.set('elements.line', { borderWidth: 2 })
  ChartJS.defaults.set('elements.point', { radius: 0, hoverRadius: 4, hitRadius: 12 })
  ChartJS.defaults.set('elements.bar', { borderRadius: 4 })
  ChartJS.defaults.set('plugins.legend.labels', { usePointStyle: true, boxWidth: 8, boxHeight: 8 })
}
