import { writeFile, mkdir } from 'node:fs/promises';

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|avif)$/i;
const GITHUB_REPO = 'webkubor/picx-images-hosting';
const GITHUB_BRANCH = 'master';
const GITHUB_PAGES_BASE = 'https://webkubor.github.io/picx-images-hosting/';
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/`;
const R2_BUCKET = 'images';
const R2_PUBLIC_BASE = 'https://img.webkubor.online/';

const encodePath = (value) => value.split('/').map(encodeURIComponent).join('/');
const firstSegment = (value) => (value.includes('/') ? value.split('/')[0] : '(root)');
const bytesToMb = (bytes) => Math.round((bytes / 1024 / 1024) * 100) / 100;

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

async function fetchGithubImages() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'pictures-lib-gallery',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const tree = await fetchJson(
    `https://api.github.com/repos/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`,
    { headers },
  );

  return tree.tree
    .filter((item) => item.type === 'blob' && IMAGE_EXTENSIONS.test(item.path))
    .map((item) => ({
      id: `github:${item.path}`,
      source: 'github',
      bucket: GITHUB_REPO,
      path: item.path,
      name: item.path.split('/').pop(),
      folder: firstSegment(item.path),
      size: item.size ?? null,
      sizeMb: typeof item.size === 'number' ? bytesToMb(item.size) : null,
      contentType: inferContentType(item.path),
      lastModified: null,
      url: `${GITHUB_PAGES_BASE}${encodePath(item.path)}`,
      rawUrl: `${GITHUB_RAW_BASE}${encodePath(item.path)}`,
    }));
}

function inferContentType(path) {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'avif') return 'image/avif';
  return 'image/*';
}

async function fetchR2Objects() {
  const accountId = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CF_DNS_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;

  if (!accountId || !token) {
    throw new Error('Missing CF_ACCOUNT_ID/CLOUDFLARE_ACCOUNT_ID or Cloudflare API token env.');
  }

  const items = [];
  let cursor = null;

  do {
    const params = new URLSearchParams({ per_page: '1000' });
    if (cursor) params.set('cursor', cursor);

    const payload = await fetchJson(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${R2_BUCKET}/objects?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      },
    );

    if (!payload.success) {
      throw new Error(`Cloudflare API failed: ${JSON.stringify(payload.errors || [])}`);
    }

    items.push(...payload.result);
    cursor = payload.result_info?.is_truncated ? payload.result_info.cursor : null;
  } while (cursor);

  const imageItems = items.filter((item) => {
    const contentType = item.http_metadata?.contentType || item.http_metadata?.content_type || '';
    return contentType.startsWith('image/') || IMAGE_EXTENSIONS.test(item.key);
  });

  return {
    objectsTotal: items.length,
    nonImagesTotal: items.length - imageItems.length,
    images: imageItems.map((item) => ({
      id: `r2:${item.key}`,
      source: 'r2',
      bucket: R2_BUCKET,
      path: item.key,
      name: item.key.split('/').pop(),
      folder: firstSegment(item.key),
      size: item.size ?? null,
      sizeMb: typeof item.size === 'number' ? bytesToMb(item.size) : null,
      contentType: item.http_metadata?.contentType || item.http_metadata?.content_type || inferContentType(item.key),
      lastModified: item.last_modified || null,
      url: `${R2_PUBLIC_BASE}${encodePath(item.key)}`,
      etag: item.etag || null,
    })),
  };
}

function summarize(items) {
  const sources = new Map();
  const folders = new Map();
  let totalBytes = 0;

  for (const item of items) {
    sources.set(item.source, (sources.get(item.source) || 0) + 1);
    const folderKey = `${item.source}:${item.folder}`;
    folders.set(folderKey, {
      source: item.source,
      name: item.folder,
      count: (folders.get(folderKey)?.count || 0) + 1,
    });
    if (typeof item.size === 'number') totalBytes += item.size;
  }

  return {
    total: items.length,
    totalSizeMb: bytesToMb(totalBytes),
    sources: Object.fromEntries([...sources.entries()].sort()),
    folders: [...folders.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

async function main() {
  const [github, r2] = await Promise.all([fetchGithubImages(), fetchR2Objects()]);
  const items = [...github, ...r2.images].sort((a, b) => {
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    const dateA = a.lastModified ? Date.parse(a.lastModified) : 0;
    const dateB = b.lastModified ? Date.parse(b.lastModified) : 0;
    if (dateA !== dateB) return dateB - dateA;
    return a.path.localeCompare(b.path);
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    sources: {
      github: {
        repo: GITHUB_REPO,
        branch: GITHUB_BRANCH,
        publicBase: GITHUB_PAGES_BASE,
        imagesTotal: github.length,
      },
      r2: {
        bucket: R2_BUCKET,
        publicBase: R2_PUBLIC_BASE,
        objectsTotal: r2.objectsTotal,
        imagesTotal: r2.images.length,
        nonImagesTotal: r2.nonImagesTotal,
      },
    },
    summary: summarize(items),
    items,
  };

  await mkdir('data', { recursive: true });
  await writeFile('data/assets.json', `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload.summary, null, 2));
  console.log(`Wrote data/assets.json with ${items.length} images.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
