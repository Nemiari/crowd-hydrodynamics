import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// import tailwindcss from '@tailwindcss/vite';
// import path from 'path';


// https://vite.dev/config/
export default defineConfig({
	base: '/crowd-hydrodynamics/',
	plugins: [
		react(),
		// tailwindcss()
	],

	// resolve: {
	// 	alias: {
	// 		"@":			path.resolve(__dirname, "src/"),
	// 		"@apps":	path.resolve(__dirname, "src/applications/"),
	// 		"@icons":	path.resolve(__dirname, "src/assets/icons/"),
	// 		"@types":	path.resolve(__dirname, "src/types/"),
	// 	},
	// 	extensions: ['.js', '.jsx', '.ts', '.tsx'],
	// },
})
