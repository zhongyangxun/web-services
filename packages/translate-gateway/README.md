# translate-gateway

Remote translation API for puzzledict. Proxies the third party translate API on Cloudflare Workers.

## Upstream

- Translate API: [Youdao](https://fanyi.youdao.com/openapi/)
- Direction: `auto` -> Simplified Chinese (`zh-CHS`)

## Endpoint

`POST /translate` with `{ "text": string }` (1–2000 chars after trim).

Success: `{ "query": string, "translation": string }`.
No usable Chinese translation: `422`.

Request path includes signature, CORS, rate limit, daily quota, and caching (see the [root README](../../README.md)).
