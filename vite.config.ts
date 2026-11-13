import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const port = Number(process.env.PORT) || 3000

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  server: { port, strictPort: true },
  preview: { port, strictPort: true },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
})
