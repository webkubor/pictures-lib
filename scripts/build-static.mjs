import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/data', { recursive: true });
await cp('index.html', 'dist/index.html');
await cp('favicon.svg', 'dist/favicon.svg');
await cp('css', 'dist/css', { recursive: true });
await cp('js', 'dist/js', { recursive: true });
await cp('data/assets.json', 'dist/data/assets.json');
await writeFile('dist/_routes.json', `${JSON.stringify({ version: 1, include: ['/api/*'], exclude: [] }, null, 2)}\n`);

console.log('Built static site into dist/');
