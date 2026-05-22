declare module '../lib/uplot/uPlot.esm.js' {
  interface UPlotOptions {
    width: number
    height: number
    title?: string
    cursor?: { show?: boolean }
    legend?: { show?: boolean }
    scales?: Record<string, { time?: boolean }>
    axes?: Array<{ stroke?: string; grid?: { stroke?: string } }>
    series?: Array<{ label?: string; stroke?: string; width?: number } | object>
  }

  export default class uPlot {
    constructor(opts: UPlotOptions, data: unknown[][], target: HTMLElement)
    destroy(): void
  }
}
