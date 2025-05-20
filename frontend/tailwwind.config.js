// process-mining-ai-poc/frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    // If you were using the `app` directory (Next.js 13+ App Router):
    // "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // You can extend Tailwind's default theme here.
      // For the PoC, the default theme is likely sufficient.
      // Example: Adding custom brand colors (PRD does not specify these)
      colors: {
        // 'brand-primary': '#YOUR_PRIMARY_COLOR',
        // 'brand-secondary': '#YOUR_SECONDARY_COLOR',
        // 'brand-accent': '#YOUR_ACCENT_COLOR',
        // 'brand-neutral': '#YOUR_NEUTRAL_COLOR_LIGHT',
        // 'brand-neutral-dark': '#YOUR_NEUTRAL_COLOR_DARK',
      },
      // Example: Adding custom fonts (ensure they are loaded in _app.tsx or globals.css)
      fontFamily: {
        // sans: ['Inter', 'system-ui', 'sans-serif'], // Example if you add 'Inter' font
        // heading: ['YourHeadingFont', 'serif'],
      },
      // Example: Extending spacing, breakpoints, etc.
      // spacing: {
      //   '128': '32rem',
      // }
    },
  },
  plugins: [
    // require('@tailwindcss/forms'), // Uncomment if you want enhanced default styling for form elements
    // require('@tailwindcss/typography'), // Uncomment if you plan to render rich text/markdown (prose styles)
    // require('@tailwindcss/aspect-ratio'), // Uncomment if you need aspect ratio utilities
  ],
};