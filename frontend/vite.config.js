import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import tailwindcss from '@tailwindcss/vite'
// import { reactRouter } from "@react-router/dev/vite" // décommenter si installé
// import tsconfigPaths from "vite-tsconfig-paths" // décommenter si installé

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // tailwindcss(),
    // reactRouter(), // décommenter si installé
    // tsconfigPaths(), // décommenter si installé
  ],
})
