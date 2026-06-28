import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/laodongzhongcai/' : '/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          if (id.includes('echarts') || id.includes('react-echarts')) {
            return 'echarts-vendor'
          }

          if (id.includes('recharts')) {
            return 'recharts-vendor'
          }

          if (id.includes('socket.io-client')) {
            return 'socket-vendor'
          }

          return undefined
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5003',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: 'http://localhost:5003',
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  }
})
