import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/LLM_NIDS/',
  build: {
    outDir: '../../docs',
    emptyOutDir: false,
  },
})
