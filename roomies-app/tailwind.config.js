/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#2563EB',
          mint: '#10B981',
          violet: '#8B5CF6',
          coral: '#F43F5E',
          neonBlue: '#3B82F6',
          neonMint: '#34D399',
          neonViolet: '#A78BFA',
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        cursive: ['Pacifico', 'cursive'],
      },
      backdropBlur: {
        xs: '2px',
        '4xl': '80px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-across': 'slideAcross 0.4s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          from: { boxShadow: '0 0 10px rgba(245, 158, 11, 0.5)' },
          to: { boxShadow: '0 0 20px rgba(245, 158, 11, 0.9), 0 0 40px rgba(245, 158, 11, 0.3)' },
        },
        slideAcross: {
          from: { transform: 'translateX(0%)' },
          to: { transform: 'translateX(calc(100% - 56px))' },
        },
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
        'glass-lg': '0 20px 60px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.6)',
        'neon-blue': '0 0 20px rgba(37, 99, 235, 0.5), 0 0 40px rgba(37, 99, 235, 0.2)',
        'neon-mint': '0 0 20px rgba(16, 185, 129, 0.5), 0 0 40px rgba(16, 185, 129, 0.2)',
        'neon-violet': '0 0 20px rgba(139, 92, 246, 0.5), 0 0 40px rgba(139, 92, 246, 0.2)',
        'neon-coral': '0 0 20px rgba(244, 63, 94, 0.5), 0 0 40px rgba(244, 63, 94, 0.2)',
      },
    },
  },
  plugins: [],
}
