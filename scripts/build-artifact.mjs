// Packages the app as a Claude artifact page (opened inside Claude, the AI uses
// the viewer's own Claude account). Output: dist/artifact/index.html + js/*.js
//   node scripts/build-artifact.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('styles.css', 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).trim();

// The artifact viewer adds its own <html>/<head>/<body>; title and style go first.
const page = `<title>Dynamic Pictograms</title>
<style>
${css}
</style>
${body}
`;
mkdirSync('dist/artifact/js', { recursive: true });
writeFileSync('dist/artifact/index.html', page);
for (const f of readdirSync('js')) if (f.endsWith('.js')) copyFileSync(`js/${f}`, `dist/artifact/js/${f}`);
console.log('Built dist/artifact (index.html + js/)');
