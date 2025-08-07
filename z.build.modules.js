const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['build_js_modules/milkdown-entry.js'], // Einstiegspunkt (siehe unten)
  bundle: true,
  minify: true,
  outfile: 'public/admin/milkdown_editor/milkdown.bundle.js', // Ausgabe in public
  format: 'esm', // Für Browser-Kompatibilität
  platform: 'browser', // Ensure all dependencies are bundled for the browser
}).then(() => console.log('Build abgeschlossen'));