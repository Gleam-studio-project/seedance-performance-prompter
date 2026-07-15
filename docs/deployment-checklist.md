# Deployment Checklist

## 1. 发布前配置

- [ ] `OPENAI_API_KEY` 只存在于平台 Secret/Environment Variables，不在 Git、构建日志或前端代码中。
- [ ] `OPENAI_BASE_URL` 使用 HTTPS，`OPENAI_MODEL` 与供应商模型名一致。
- [ ] `OPENAI_MODEL_OPTIONS` 只包含团队批准的模型。
- [ ] 团队统一 Key 模式设置 `ALLOW_CLIENT_API_KEY=false`。
- [ ] 不需要第三方模型网关时设置 `ALLOW_CLIENT_BASE_URL=false`。
- [ ] 如需团队访问保护，设置 `ENABLE_AUTH=true`、强 `APP_PASSWORD`，并使用非默认 `APP_USER`；默认可不启用登录。
- [ ] 前端与 API 同域时 `CORS_ORIGIN` 留空；跨域时只填写唯一可信 HTTPS Origin。

## 2. 发布前验证

```bash
npm test
npm run check
npm run eval:check
git diff --check
```

验收：全部命令退出码为 0，测试覆盖鉴权、CORS、安全头、模型配置开关、MD/DOCX 上传和 Prompt 契约。

## 3. Docker 验证

```bash
docker build -t performance-prompter:test .
docker run --rm --env-file .env -e NODE_ENV=production -e HOST=0.0.0.0 -p 4174:4174 performance-prompter:test
```

另一个终端验证：

```bash
curl -f http://127.0.0.1:4174/healthz
curl -f -u team:p2-test-password http://127.0.0.1:4174/api/status
curl -f -u team:p2-test-password -F file=@examples/example-billionaire-reveal.md http://127.0.0.1:4174/api/extract-file
```

验收：首页与 API 按 `ENABLE_AUTH` 配置访问；健康检查 GET/HEAD 为 200；状态响应不含 Key；MD/DOCX 抽取成功。

## 4. Vercel 预检与发布

```bash
vercel build
vercel --prod
```

`vercel --prod` 会改变线上版本，执行前必须获得用户明确授权。团队统一 Key 模式应在 Vercel 项目环境变量中覆盖 `vercel.json` 当前的客户端 Key 开关：

```text
ALLOW_CLIENT_API_KEY=false
ALLOW_CLIENT_BASE_URL=false
```

## 5. 发布后验证

- [ ] `GET /` 返回 200，并包含 CSP、`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`。
- [ ] `/server.js`、`/package.json`、`/tests/`、`/evals/` 等非前端路径统一返回 404。
- [ ] `GET /healthz` 与 `HEAD /healthz` 返回 200。
- [ ] `ENABLE_AUTH=true` 时未登录 `/api/status` 返回 401，错误凭据仍返回 401；默认关闭时返回 200。
- [ ] 鉴权开启时正确凭据 `/api/status` 返回 200，响应和日志不含 Key/密码。
- [ ] OPTIONS 返回 204，生产 CORS 不是 `*`。
- [ ] Markdown 与合成 DOCX 上传抽取成功。
- [ ] `npm run smoke:ai` 使用生产配置完成至少 1 次。
- [ ] 记录部署 URL、提交 SHA、模型名与验证时间到 `Progress.md`。

## 6. 回滚

- 保留上一个可用 Vercel Deployment ID 或容器镜像 tag。
- 健康检查、鉴权、文件抽取或模型冒烟任一失败时停止团队试用并回滚。
- 不通过降低鉴权、开放任意 CORS 或启用客户端 Base URL 来规避故障。

## 已知边界

- Basic Auth 是 MVP 访问保护，不是正式账号权限系统。
- Vercel PDF/DOC 能力弱于 Docker；扫描 PDF 不支持 OCR。
- 进程内没有持久化限流和团队用量统计，必须使用平台额度/告警控制模型成本。
