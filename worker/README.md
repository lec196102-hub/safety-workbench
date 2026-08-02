# Safety AI Proxy（DeepSeek 代理 Worker）

本目录包含一个 Cloudflare Worker，作为前端「安全生产工作台」与 DeepSeek AI 之间的代理层。它接收隐患数据，调用 DeepSeek `chat/completions`（JSON 模式）生成隐患趋势分析，并返回结构化结果。

## 目录结构

```
worker/
├── ai-proxy.js     # Worker 主代码（入口）
├── wrangler.toml   # Cloudflare Workers 配置
└── README.md       # 本说明文件
```

## 功能说明

- 接收 `POST` 请求，请求体格式：

  ```json
  {
    "hazards": [
      {
        "id": "string",
        "date": "2026-08-01",
        "location": "string",
        "description": "string",
        "responsible": "string",
        "acceptTime": "2026-08-05",
        "isFixed": false
      }
    ],
    "month": "2026-08",
    "year": "2026"
  }
  ```

- 当 `hazards` 为空数组或缺失时，直接返回空结构，不调用 DeepSeek API。
- 调用 DeepSeek（`model: deepseek-chat`，`temperature: 0.3`，`max_tokens: 2048`，`response_format: json_object`）。
- 返回结构：

  ```json
  {
    "monthlyTrend": { "days": ["1号", "2号"], "counts": [1, 0] },
    "yearlyTrend": { "months": ["1月", "2月"], "counts": [3, 5] },
    "monthlyStats": { "total": 10, "unfixed": 4, "fixing": 0, "fixed": 6, "rate": 60 },
    "analysis": "一段200字左右的趋势分析文字"
  }
  ```

- 自动加上 CORS 响应头（`Access-Control-Allow-Origin: *`），并处理 `OPTIONS` 预检请求。
- 对 DeepSeek 返回内容做 markdown 代码块清洗、JSON 解析、字段校验与补全；当 API 不可用或返回异常时，使用本地兜底计算保证前端可用。

## 前置准备

1. 注册 [Cloudflare](https://www.cloudflare.com/) 账号。
2. 在 [DeepSeek 开放平台](https://platform.deepseek.com/) 申请 API Key。
3. 本机安装 Node.js（建议 18+）。

## 部署步骤

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
# 或在项目内：
# npm install --save-dev wrangler
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

执行后会打开浏览器完成 Cloudflare 授权。

### 3. 设置 DeepSeek API Key（密钥）

API Key 属于敏感信息，**不要**写入 `wrangler.toml`，请使用 secret 命令：

```bash
cd worker
wrangler secret put DEEPSEEK_API_KEY
```

在交互提示中粘贴你的 DeepSeek API Key，回车确认。该密钥会加密存储在 Cloudflare，并以环境变量 `DEEPSEEK_API_KEY` 注入到 Worker 运行时。

### 4. 本地调试（可选）

```bash
cd worker
wrangler dev
```

启动后会在本地提供一个地址（默认 `http://localhost:8787`）。可用 `curl` 测试：

```bash
curl -X POST http://localhost:8787/ ^
  -H "Content-Type: application/json" ^
  -d "{\"hazards\":[{\"id\":\"1\",\"date\":\"2026-08-01\",\"location\":\"车间A\",\"description\":\"线路老化\",\"responsible\":\"张三\",\"acceptTime\":\"2026-08-05\",\"isFixed\":false}],\"month\":\"2026-08\",\"year\":\"2026\"}"
```

> 注意：`wrangler dev` 默认不会自动注入已设置的线上 secret。如需本地调试用到真实 Key，可在项目根目录创建 `.dev.vars` 文件：
>
> ```
> DEEPSEEK_API_KEY=sk-你的key
> ```
>
> `.dev.vars` 请加入 `.gitignore`，切勿提交到仓库。

### 5. 部署到 Cloudflare

```bash
cd worker
wrangler deploy
```

部署成功后，终端会输出 Worker 的访问地址，形如：

```
https://safety-ai-proxy.<你的子域>.workers.dev
```

### 6. 前端对接

将上一步得到的 Worker 地址配置到前端项目中，前端以 `POST` 方式调用，请求体如上文「功能说明」所示。Worker 会返回带 CORS 头的结构化 JSON，前端可直接解析使用。

## 常用命令速查

| 命令 | 作用 |
| --- | --- |
| `wrangler login` | 登录 Cloudflare 账号 |
| `wrangler whoami` | 查看当前登录账号 |
| `wrangler dev` | 本地调试运行 Worker |
| `wrangler deploy` | 部署 Worker 到线上 |
| `wrangler secret put DEEPSEEK_API_KEY` | 设置 DeepSeek API Key |
| `wrangler secret list` | 查看已设置的 secret 列表 |
| `wrangler tail` | 实时查看线上 Worker 日志 |

## 常见问题

- **部署后返回 `未配置 DEEPSEEK_API_KEY`**：说明未设置 secret，或设置后未重新部署。请执行 `wrangler secret put DEEPSEEK_API_KEY`，secret 设置后对已部署的 Worker 立即生效，无需重新 `deploy`。
- **返回 502 / DeepSeek API 错误**：请检查 API Key 是否有效、账户余额是否充足、网络是否能访问 `api.deepseek.com`。
- **返回的 `counts` 长度与 `days/months` 不一致**：Worker 已做对齐与补全处理，若仍异常会自动回退到本地兜底计算结果。
