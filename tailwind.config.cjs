/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{ts,tsx,html}'
  ],
  theme: {
    extend: {
      colors: {
        discovery: '#2563EB',
        technical: '#F97316',
        surface: '#0F172A',
        accent: '#22D3EE'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
