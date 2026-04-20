import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createServer } from 'http'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        secure: false,
        // 排除前端状态检查端点
        exclude: ['/api/frontend/status']
      }
    }
  }
})
