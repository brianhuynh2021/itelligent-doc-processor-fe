"use client"

import { cn } from "@/lib/utils"

/**
 * Dependency-free SVG chart primitives themed with the --chart-* design tokens.
 * Kept intentionally small: bar, donut, line/sparkline, and a calendar heatmap.
 */

const CHART_FILL = [
  "fill-chart-1",
  "fill-chart-2",
  "fill-chart-3",
  "fill-chart-4",
  "fill-chart-5",
] as const

const CHART_STROKE = [
  "stroke-chart-1",
  "stroke-chart-2",
  "stroke-chart-3",
  "stroke-chart-4",
  "stroke-chart-5",
] as const

// Literal classes so Tailwind's JIT scanner picks them up (no runtime concat).
const CHART_BG = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
] as const

export function chartFill(index: number) {
  return CHART_FILL[index % CHART_FILL.length]
}

export function chartStroke(index: number) {
  return CHART_STROKE[index % CHART_STROKE.length]
}

export function chartBg(index: number) {
  return CHART_BG[index % CHART_BG.length]
}

export type ChartDatum = {
  label: string
  value: number
  colorIndex?: number
}

/* ---------------------------------------------------------------- BarChart */

export function BarChart({
  data,
  height = 220,
  formatValue = (v: number) => v.toLocaleString(),
  className,
}: {
  data: ChartDatum[]
  height?: number
  formatValue?: (value: number) => string
  className?: string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const barCount = Math.max(1, data.length)
  const gap = 12
  const width = 480
  const barW = (width - gap * (barCount - 1)) / barCount

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        preserveAspectRatio="none"
      >
        {data.map((d, i) => {
          const barH = Math.round((d.value / max) * (height - 28))
          const x = i * (barW + gap)
          const y = height - barH - 20
          return (
            <g key={`${d.label}-${i}`}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(barH, 2)}
                rx={4}
                className={cn(chartFill(d.colorIndex ?? i), "transition-all")}
              />
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                className="fill-foreground text-[11px] font-medium"
              >
                {formatValue(d.value)}
              </text>
              <text
                x={x + barW / 2}
                y={height - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* -------------------------------------------------------------- DonutChart */

export function DonutChart({
  data,
  size = 180,
  thickness = 26,
  centerLabel,
  centervalue,
  className,
}: {
  data: ChartDatum[]
  size?: number
  thickness?: number
  centerLabel?: string
  centervalue?: string
  className?: string
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className={cn("flex items-center gap-6", className)}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-40 w-40 shrink-0 -rotate-90"
        role="img"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-muted"
        />
        {total > 0 &&
          data.map((d, i) => {
            const fraction = d.value / total
            const dash = fraction * circumference
            const circle = (
              <circle
                key={`${d.label}-${i}`}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                className={cn(chartStroke(d.colorIndex ?? i), "transition-all")}
              />
            )
            offset += dash
            return circle
          })}
      </svg>
      <div className="space-y-2">
        {(centerLabel || centervalue) && (
          <div className="mb-3">
            {centervalue && (
              <div className="text-2xl font-bold leading-none">{centervalue}</div>
            )}
            {centerLabel && (
              <div className="text-xs text-muted-foreground">{centerLabel}</div>
            )}
          </div>
        )}
        <ul className="space-y-1.5">
          {data.map((d, i) => (
            <li key={`${d.label}-${i}`} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  "inline-block h-2.5 w-2.5 rounded-sm",
                  chartBg(d.colorIndex ?? i),
                )}
              />
              <span className="text-muted-foreground">{d.label}</span>
              <span className="ml-auto font-medium tabular-nums">
                {d.value.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- LineChart */

export function LineChart({
  data,
  height = 220,
  colorIndex = 0,
  formatValue = (v: number) => v.toLocaleString(),
  className,
}: {
  data: ChartDatum[]
  height?: number
  colorIndex?: number
  formatValue?: (value: number) => string
  className?: string
}) {
  const width = 480
  const padX = 8
  const padY = 24
  const max = Math.max(1, ...data.map((d) => d.value))
  const stepX =
    data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0
  const points = data.map((d, i) => {
    const x = padX + i * stepX
    const y = height - padY - (d.value / max) * (height - padY * 2)
    return { x, y, d }
  })

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ")
  const first = points[0]
  const last = points[points.length - 1]
  const areaPath =
    first && last
      ? `${linePath} L ${last.x.toFixed(1)} ${height - padY} L ${first.x.toFixed(
          1,
        )} ${height - padY} Z`
      : ""

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        preserveAspectRatio="none"
      >
        {areaPath && (
          <path
            d={areaPath}
            className={cn(chartFill(colorIndex))}
            fillOpacity={0.12}
          />
        )}
        <path
          d={linePath}
          fill="none"
          strokeWidth={2.5}
          className={cn(chartStroke(colorIndex))}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={3}
              className={cn(chartFill(colorIndex))}
            />
            {(i === 0 ||
              i === points.length - 1 ||
              data.length <= 8) && (
              <text
                x={p.x}
                y={height - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {p.d.label}
              </text>
            )}
          </g>
        ))}
        {points.length > 0 && (
          <text
            x={padX}
            y={14}
            className="fill-muted-foreground text-[10px]"
          >
            max {formatValue(max)}
          </text>
        )}
      </svg>
    </div>
  )
}

/* --------------------------------------------------------------- Heatmap */

export type HeatmapCell = {
  row: number
  col: number
  value: number
}

export function Heatmap({
  cells,
  rows,
  cols,
  rowLabels,
  colLabels,
  formatValue = (v: number) => v.toLocaleString(),
  className,
}: {
  cells: HeatmapCell[]
  rows: number
  cols: number
  rowLabels?: string[]
  colLabels?: string[]
  formatValue?: (value: number) => string
  className?: string
}) {
  const max = Math.max(1, ...cells.map((c) => c.value))
  const grid = new Map<string, number>()
  for (const c of cells) grid.set(`${c.row}:${c.col}`, c.value)

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <div className="inline-flex flex-col gap-1">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-1">
            {rowLabels && (
              <span className="w-10 shrink-0 text-right text-[11px] text-muted-foreground">
                {rowLabels[r]}
              </span>
            )}
            {Array.from({ length: cols }).map((_, c) => {
              const value = grid.get(`${r}:${c}`) ?? 0
              const intensity = value / max
              return (
                <div
                  key={c}
                  title={`${value === 0 ? "—" : formatValue(value)}`}
                  className="h-5 w-5 rounded-sm border border-border bg-chart-1"
                  style={{ opacity: value === 0 ? 0.08 : 0.2 + intensity * 0.8 }}
                />
              )
            })}
          </div>
        ))}
        {colLabels && (
          <div className="flex items-center gap-1">
            {rowLabels && <span className="w-10 shrink-0" />}
            {colLabels.map((label, c) => (
              <span
                key={c}
                className="w-5 text-center text-[9px] text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
