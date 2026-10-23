import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// VITE_BASE is set only for GitHub Pages (e.g. /direct-selling-db/). Cloudflare/Netlify use the default "/".
export default defineConfig({ base: process.env.VITE_BASE || '/', plugins: [react()], build: { target: 'es2020' } })
