# kk-pi-extensions

个人 [Pi](https://pi.dev) 扩展集合。一个扩展一个目录，Pi 通过 `package.json` 的 `pi.extensions` glob 加载所有 `extensions/*/index.ts`。

## 安装

```bash
pi install /Users/hui/IProjects/individual/kk-pi-extensions   # 本地路径，不复制
pi list
```

改完代码 `/reload` 或重启 pi 生效。

## 插件

### deepseek-search

`web_search` / `web_fetch`，底层用 [DeepSeek Search & Fetch API](https://api-docs.deepseek.com/zh-cn/guides/search)。

Key 只从 `~/.pi/agent/deepseek-search.json` 读：

```json
{ "apiKey": "$DEEPSEEK_API_KEY" }
```

`apiKey` 以 `$` 开头按环境变量解析（`$NAME` 或 `${NAME}`），否则按字面值。

## 新增插件

```bash
mkdir extensions/my-plugin
```

写 `extensions/my-plugin/index.ts`，导出默认工厂函数，然后 `/reload`：

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("hello", {
    description: "Say hi",
    handler: async (_args, ctx) => ctx.ui.notify("hi", "info"),
  });
}
```

## 目录

```
package.json                 # pi package 清单（pi.extensions: ./extensions/*/index.ts）
extensions/deepseek-search/
└── index.ts                 # 两个工具 + key 解析，单文件
```
