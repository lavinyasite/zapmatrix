/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#000000",
                primary: "#00ff41",
                secondary: "#003b00",
                accent: "#ffffff",
                surface: "#0a0a0a",
            }
        },
    },
    plugins: [],
}
