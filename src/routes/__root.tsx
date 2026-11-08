import { createRootRoute, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

import '../styles.css'

// Devtools load only in development, so they never ship in the app.
const Devtools = import.meta.env.DEV
  ? lazy(() => import('../devtools'))
  : () => null

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <Outlet />
      <Suspense>
        <Devtools />
      </Suspense>
    </>
  )
}
