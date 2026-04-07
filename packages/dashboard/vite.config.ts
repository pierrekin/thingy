import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	plugins: [
		tailwindcss(),
		react(),
		VitePWA({
			registerType: "autoUpdate",
			workbox: {
				globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
				navigateFallback: "index.html",
				navigateFallbackDenylist: [/^\/api\//],
			},
			manifest: {
				name: "Mantle",
				short_name: "Mantle",
				description: "Mantle Dashboard",
				theme_color: "#863bff",
				background_color: "#e5e7eb",
				display: "standalone",
				icons: [
					{
						src: "pwa-192x192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "pwa-512x512.png",
						sizes: "512x512",
						type: "image/png",
					},
					{
						src: "pwa-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
		}),
	],
	server: {
		proxy: {
			"/api": {
				target: "http://localhost:8080",
				ws: true,
			},
		},
	},
});
