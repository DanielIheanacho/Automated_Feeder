
"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export function DarkModeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Render a placeholder or null on the server and during initial client mount
    // to avoid hydration mismatch, as theme is resolved on client.
    return (
      <div className="flex items-center space-x-2 h-10">
        <Sun className="h-[1.2rem] w-[1.2rem]" />
        <Switch id="theme-toggle-placeholder" disabled />
        <Moon className="h-[1.2rem] w-[1.2rem]" />
      </div>
    )
  }

  const isDarkMode = theme === "dark"

  const toggleTheme = () => {
    setTheme(isDarkMode ? "light" : "dark")
  }

  return (
    <div className="flex items-center space-x-2">
      <Sun className={`h-[1.2rem] w-[1.2rem] transition-colors ${isDarkMode ? 'text-sidebar-foreground/50' : 'text-sidebar-accent'}`} />
      <Switch
        id="theme-toggle"
        checked={isDarkMode}
        onCheckedChange={toggleTheme}
        aria-label="Toggle dark mode"
      />
      <Moon className={`h-[1.2rem] w-[1.2rem] transition-colors ${isDarkMode ? 'text-sidebar-accent' : 'text-sidebar-foreground/50'}`} />
    </div>
  )
}

// Alternative Button version (more common UI):
// export function DarkModeToggle() {
//   const { setTheme, theme } = useTheme()
//   const [mounted, setMounted] = React.useState(false)

//   React.useEffect(() => {
//     setMounted(true)
//   }, [])

//   if (!mounted) {
//     return <Button variant="ghost" size="icon" disabled className="w-9 h-9"><Sun className="h-[1.2rem] w-[1.2rem]" /></Button>;
//   }

//   return (
//     <Button
//       variant="ghost"
//       size="icon"
//       onClick={() => setTheme(theme === "light" ? "dark" : "light")}
//       className="w-9 h-9"
//       aria-label="Toggle theme"
//     >
//       <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
//       <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
//     </Button>
//   )
// }
