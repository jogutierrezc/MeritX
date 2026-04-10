import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/apifreellm': {
        target: 'https://apifreellm.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/apifreellm/, ''),
      },
    },
  },
})
