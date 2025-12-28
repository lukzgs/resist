/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ["Inter", "sans-serif"],
                display: ["Rajdhani", "sans-serif"],
                mono: ["Fira Code", "monospace"],
            },
            colors: {
                resistance: "#0ea5e9",
                spy: "#ef4444",
                dark: "#050505",
                card: "#0f172a",
            },
            animation: {
                "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "float": "float 6s ease-in-out infinite",
                "scan": "scan 4s linear infinite",
                "glitch": "glitch 1s linear infinite",
                "infinite-scroll": "scroll 2s linear infinite",
            },
            keyframes: {
                float: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-10px)" },
                },
                scan: {
                    "0%": { top: "-10%" },
                    "100%": { top: "110%" },
                },
                glitch: {
                    "0%": { transform: "translate(0)" },
                    "20%": { transform: "translate(-2px, 2px)" },
                    "40%": { transform: "translate(-2px, -2px)" },
                    "60%": { transform: "translate(2px, 2px)" },
                    "80%": { transform: "translate(2px, -2px)" },
                    "100%": { transform: "translate(0)" },
                },
                scroll: {
                    "0%": { transform: "translateX(-100%)" },
                    "100%": { transform: "translateX(200%)" },
                },
            },
            boxShadow: {
                "glow-blue": "0 0 20px -5px rgba(14, 165, 233, 0.6)",
                "glow-red": "0 0 20px -5px rgba(239, 68, 68, 0.6)",
                "glow-gold": "0 0 20px -5px rgba(234, 179, 8, 0.6)",
            },
        },
    },
    plugins: [],
};
