import { createContext, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  /** Pantallas diseñadas solo en oscuro (muro de fotos): lo fuerzan mientras están abiertas */
  forceDark: (on: boolean) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  forceDark: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )
  const [forced, setForced] = useState(0)

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove("light", "dark")

    if (forced > 0) {
      root.classList.add("dark")
      return
    }

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme, forced])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
    forceDark: (on: boolean) => setForced((n) => Math.max(0, n + (on ? 1 : -1))),
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}

/**
 * Para las pantallas del muro de fotos (invitado, pantalla y panel del evento):
 * están diseñadas en oscuro, y con el teléfono o la compu en modo claro quedaban
 * textos claros sobre fondo claro.
 */
export function ForceDark({ children }: { children: ReactNode }) {
  const { forceDark } = useTheme()
  useEffect(() => {
    forceDark(true)
    return () => forceDark(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return <>{children}</>
}
