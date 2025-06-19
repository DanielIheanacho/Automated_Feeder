
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Initialize with a value that matches server-side rendering (e.g., false for non-mobile)
  // This ensures the first client render matches the server.
  const [isMobile, setIsMobile] = React.useState(false)
  const [hasMounted, setHasMounted] = React.useState(false)

  React.useEffect(() => {
    setHasMounted(true) // Indicate that the component has mounted on the client

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    // Set the initial value on mount and listen for changes
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    mql.addEventListener("change", onChange)

    return () => mql.removeEventListener("change", onChange)
  }, []) // Empty dependency array ensures this runs once on mount

  // During SSR or before hydration on the client, hasMounted is false.
  // Return the default (server-side assumed) value.
  if (!hasMounted) {
    return false;
  }

  // After mounting on the client, return the actual determined isMobile state.
  return isMobile
}
