import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    plugins: [react()],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/core/index.ts'),
            name: 'SelfHealingRuntime',
            fileName: (format) => `index.${format}.js`,
            formats: ['es', 'cjs', 'umd']
        },
        rollupOptions: {
            external: ['react', 'react-dom', 'zustand', 'immer'],
            output: {
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM',
                    zustand: 'Zustand',
                    immer: 'Immer'
                }
            }
        },
        outDir: 'dist-lib',
        emptyOutDir: true,
        sourcemap: true
    }
});
