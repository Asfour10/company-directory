import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Enable code splitting and lazy loading
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@headlessui/react', '@heroicons/react'],
          // Feature-based chunks
          'admin-pages': [
            './src/pages/AdminDashboardPage.tsx',
            './src/pages/AdminEmployeeManagementPage.tsx',
            './src/pages/AdminCustomFieldsPage.tsx',
            './src/pages/AdminAuditLogPage.tsx',
            './src/pages/AdminTenantSettingsPage.tsx'
          ],
          'employee-pages': [
            './src/pages/EmployeeDirectoryPage.tsx',
            './src/pages/EmployeeProfilePage.tsx',
            './src/pages/EmployeeEditPage.tsx'
          ]
        },
        // Optimize chunk file names for caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop()?.replace('.tsx', '').replace('.ts', '')
            : 'chunk';
          return `js/${facadeModuleId}-[hash].js`;
        },
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext || '')) {
            return `images/[name]-[hash][extname]`;
          }
          if (/css/i.test(ext || '')) {
            return `css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        }
      }
    },
    // Optimize for mobile performance
    target: 'es2015', // Support older mobile browsers
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn']
      }
    },
    // Enable source maps for debugging but keep them separate
    sourcemap: true,
    // Optimize chunk size
    chunkSizeWarningLimit: 1000, // 1MB warning limit
    // Enable CSS code splitting
    cssCodeSplit: true
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom'
    ],
    exclude: [
      // Exclude large dependencies that should be loaded on demand
    ]
  },
  // Enable compression and caching
  preview: {
    headers: {
      'Cache-Control': 'public, max-age=31536000' // 1 year cache for assets
    }
  }
});
