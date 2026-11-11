
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Enable Vite's React transform for the app's JSX files.
export default defineConfig({
    plugins: [react()],

    server: {
        port: 5173,

        // Allow Cloudflare Tunnel to access the development server.
        allowedHosts: ['.trycloudflare.com']
    }
});
