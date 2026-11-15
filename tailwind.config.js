/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#203D62',
          teal: '#16AA88',
          orange: '#F36B2C',
          yellow: '#F5A623',
          blue: '#60BCE8',
          dark: {
            bg: '#0D1B2A',
            card: '#15263C',
            cardHover: '#1B314D',
            border: '#223E63',
          }
        }
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
