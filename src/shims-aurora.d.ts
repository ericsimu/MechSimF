declare module '@aurora-design/vue' {
  import type { DefineComponent } from 'vue'

  export const AuroraButton: DefineComponent<{
    size?: 'mini' | 'small' | 'medium' | 'large'
    load?: boolean
    disabled?: boolean
    class?: string
    type?: string
    onClick?: (e: MouseEvent) => void
  }, {}, unknown>

  export function bootstrap(opts: {
    autoLoaded?: boolean
    autoLoadedDelay?: number
  }, callback: (loader: unknown) => Promise<string | void>): void
}
