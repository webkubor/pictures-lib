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

## CI/CD

主发布链路是 GitHub Actions：

```text
git push origin main -> GitHub Actions -> pnpm build -> Cloudflare Pages
```

仓库需要配置以下 GitHub Secrets：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Manual Fallback

只有 GitHub Actions 或 Cloudflare 服务异常时，才用本机手动发布：

```bash
pnpm run pages:deploy
```

生产入口：

```text
https://pictures-lib.webkubor.online
```
