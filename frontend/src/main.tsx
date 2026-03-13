import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

// Andromeda — galaxy theme is always dark
document.documentElement.classList.add('dark')
document.documentElement.classList.remove('light')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        const status = error?.response?.status
        if (typeof status === 'number' && status >= 400 && status < 500) return false
        return failureCount < 1
      },
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
