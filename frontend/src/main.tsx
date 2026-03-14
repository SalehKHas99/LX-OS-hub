import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { shouldRetryQuery } from './lib/queryRetry'
import './index.css'

if (import.meta.env.DEV) {
  console.log('[LX-OS] Dev mode — source bundle. Profiles & Messages are active.')
}

// Andromeda — galaxy theme is always dark
document.documentElement.classList.add('dark')
document.documentElement.classList.remove('light')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(4,3,12,0.82)',
            color: 'var(--text-1)',
            border: '1px solid rgba(167,139,250,0.14)',
            borderRadius: 12,
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
)
