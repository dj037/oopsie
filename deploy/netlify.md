# Netlify 前端部署

GitHub 仓库简介建议：**把外出安排转化为个性化物品清单、准备时间轴与提醒的 Personal Agent，支持拍照识别核对与行程复盘建议。**

Oopsie 不是纯静态网页。Netlify 负责公开网页，账号登录、行程数据和物品识别仍由 Node 后端提供。只上传 `dist` 而没有后端时，登录、保存和相机识别无法工作。

## 部署结构

- 网页：Netlify 静态托管，HTTPS 公网地址。
- API：项目自带的 Node 服务，可用 `render.yaml` 在 Render 创建；首次上线前需在云平台检查免费方案是否可用。识别模型也在 API 服务运行。
- API 转发：网页的 `/api/*` 由 Netlify 代理到 API 域名，使登录 Cookie 保持在同一网站来源下。

## 准备 API

先在 Render 用本项目私有仓库创建 `render.yaml` 中的服务并等待健康检查通过。获取类似 `https://oopsie-adults-demo.onrender.com` 的 API 地址。服务端需要设置 `PUBLIC_ORIGIN` 为之后的 Netlify 网站地址，例如 `https://oopsie-adults-demo.netlify.app`，再部署一次以允许该网页来源。保留 HTTPS Cookie 与临时体验提示配置。

如果 Render 不提供免费实例，或服务启动时出现内存不足，请先停止；不要选择付费套餐。该 API 同时加载本地视觉模型，云端实际可用性需上线验证。

## Netlify 发布

1. 在 Netlify 登录并创建一个新站点，绑定本项目仓库，构建目录保持 `dist`。站点创建后记下它的 `*.netlify.app` HTTPS 地址。
2. 将该地址填入 API 服务的 `PUBLIC_ORIGIN` 并重新部署后，再回 Netlify 配置构建环境变量 `OOPSIE_API_ORIGIN`，值为后端 HTTPS 域名，不要带路径或末尾 API 路径。
3. 发布触发 `npm run build:netlify`：构建网页并生成 `/api/*` 代理规则。Netlify 配置会启用体验版提示。
4. 等发布完成后，先在网站地址后打开 `/api/health`，确认返回 `ok: true`；再用手机测试注册、建行程和相机识别。

`netlify.toml` 已写好构建命令、输出目录、Node 版本和 SPA 路由。缺少 `OOPSIE_API_ORIGIN` 时构建会主动失败，避免误发一个无法登录的假站点。

## 体验限制

Render 免费实例可能休眠，临时 SQLite 数据可能清空；若启用相机，需 HTTPS 和浏览器相机授权。正式保存数据需要另配持久化数据库/存储。Netlify 外部代理有单次请求时限；若 API 冷启动或图像识别超过平台时限，需唤醒后重试或改成异步任务。服务和免费资格以平台当前实际页面为准；部署前后端都尚需使用账号完成线上验收。
