import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Enable Vite's React transform for the app's JSX files.
export default defineConfig({
    plugins: [react()]
});