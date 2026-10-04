// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';

// export default defineConfig({
//   plugins: [react()],
//   build: {
//     rollupOptions: {
//       output: {
//         manualChunks(id) {
//           if (!id.includes('node_modules')) return undefined;
//           if (id.includes('react') || id.includes('react-router-dom')) return 'vendor-react';
//           if (id.includes('@supabase')) return 'vendor-supabase';
//           if (id.includes('lucide-react')) return 'vendor-icons';
//           return 'vendor';
//         }
//       }
//     }
//   }
// });
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    cors: {
      origin: ['https://k-bwebsite-two.vercel.app', 'http://localhost:5173'],
      credentials: true
    }
  },
  preview: {
    cors: {
      origin: ['https://k-bwebsite-two.vercel.app', 'http://localhost:4173'],
      credentials: true
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react') || id.includes('react-router-dom')) return 'vendor-react';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('lucide-react')) return 'vendor-icons';
          return 'vendor';
        }
      }
    }
  }
});