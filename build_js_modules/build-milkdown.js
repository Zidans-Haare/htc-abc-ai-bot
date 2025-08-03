const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/milkdown-entry.js'], // Einstiegspunkt (siehe unten)
  bundle: true,
  minify: true,
  outfile: '../public/admin/milkdown_editor/milkdown.bundle.js', // Ausgabe in public
  format: 'iife', // Für Browser-Kompatibilität
  globalName: 'Milkdown', // Globaler Name für <script>
}).then(() => console.log('Build abgeschlossen'));