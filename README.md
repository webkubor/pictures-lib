# Pictures Lib

本机两个图床的统一图库：

- GitHub 图床：`webkubor/picx-images-hosting`
- Cloudflare R2：`https://img.webkubor.online`

页面默认按上传/修改时间倒序展示。R2 对象有 `uploadedAt/lastModified`；GitHub 当前使用 tree API 生成快照，逐文件上传时间缺失时会显示 `上传时间未知` 并排在有时间信息的图片后面。

每张图片卡片展示：

- 来源
- 上传/修改时间
- 文件大小
- 图片类型
- 顶层目录
- 原图 URL 操作

## Refresh

```bash
node scripts/refresh-gallery.mjs
```

## Build

```bash
pnpm build
```

产物输出到 `dist/`，只包含线上需要的 `index.html` 和 `data/assets.json`。

## R2 Delete

图库只支持 Cloudflare R2 真删除：

- 前端只有 R2 卡片显示 `删除 R2`
- 服务端入口：`POST /api/assets/delete`
- 删除前需要 `PICTURES_ADMIN_TOKEN`
- 前端不会硬编码口令；第一次删除时输入一次，浏览器本机保存，后续复用
- GitHub 图床只查看，不从这个站点删除

Cloudflare Pages 需要配置：

- R2 binding：`PICTURES_R2` -> bucket `images`
- Secret：`PICTURES_ADMIN_TOKEN`

本地口令只放 `.env.local`，不要提交。

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
