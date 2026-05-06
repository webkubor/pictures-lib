# Pictures Lib

本机两个图床的统一图库：

- GitHub 图床：`webkubor/picx-images-hosting`
- Cloudflare R2：`https://img.webkubor.online`

## Refresh

```bash
node scripts/refresh-gallery.mjs
```

## Build

```bash
pnpm build
```

产物输出到 `dist/`，只包含线上需要的 `index.html` 和 `data/assets.json`。

## Deploy

```bash
pnpm run pages:deploy
```

生产入口：

```text
https://pictures-lib.webkubor.online
```
