// src/config/api.js
export const API_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL_LOCAL || 'http://localhost:3000/api/send-email'
  : import.meta.env.VITE_API_URL_PROD || '/.netlify/functions/send-reset-email';

console.log('🌐 API_URL:', API_URL);
console.log('🔧 Modo:', import.meta.env.DEV ? 'Desenvolvimento' : 'Produção');
