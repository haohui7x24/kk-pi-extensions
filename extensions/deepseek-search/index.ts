/**
 * DeepSeek 搜索：给 pi 加两个工具。
 *   web_search  POST https://api.deepseek.com/v1/tools/search
 *   web_fetch   POST https://api.deepseek.com/v1/tools/fetch
 *
 * Key 只从 ~/.pi/agent/deepseek-search.json 读，值以 $ 开头时按环境变量解析：
 *   { "apiKey": "sk-..." }  或  { "apiKey": "$DEEPSEEK_API_KEY" }
 *
 * 文档：https://api-docs.deepseek.com/zh-cn/guides/search
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const BASE_URL = "https://api.deepseek.com";

function apiKey(): string {
	const path = join(process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"), "deepseek-search.json");

	let raw: string | undefined;
	try {
		raw = (JSON.parse(readFileSync(path, "utf8")) as { apiKey?: string }).apiKey?.trim();
	} catch (error) {
		throw new Error(`Cannot read ${path}: ${(error as Error).message}`);
	}
	if (!raw) throw new Error(`Set "apiKey" in ${path}`);

	if (!raw.startsWith("$")) return raw;

	const name = raw.replace(/^\$\{?|\}?$/g, "");
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`apiKey in ${path} references $${name}, but that variable is unset or empty`);
	return value;
}

async function post<T>(path: string, body: unknown, signal: AbortSignal | undefined): Promise<T> {
	const timeout = AbortSignal.timeout(60_000);
	const response = await fetch(BASE_URL + path, {
		method: "POST",
		headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
		body: JSON.stringify(body),
		signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
	});

	const text = await response.text();
	if (!response.ok) {
		let message = text.slice(0, 300);
		try {
			message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? message;
		} catch {
			// keep the raw body
		}
		throw new Error(`DeepSeek ${response.status}: ${message}`);
	}
	return JSON.parse(text) as T;
}

interface SearchResult {
	title?: string;
	url?: string;
	snippet?: string;
	summary?: string;
	content?: string;
	date?: string;
}

export default function (pi: ExtensionAPI) {
	pi.registerTool(
		defineTool({
			name: "web_search",
			label: "Web Search",
			description:
				'Search the web with DeepSeek. query supports operators: site:github.com, -site:example.com, "exact phrase", lang:zh,en, after:2025, before:2026-06-01.',
			parameters: Type.Object({
				query: Type.String({ description: "Search query, 1-128 chars" }),
				count: Type.Optional(Type.Number({ minimum: 1, maximum: 50, description: "Result count, default 10" })),
			}),
			async execute(_toolCallId, params, signal) {
				const data = await post<{ results?: SearchResult[] }>(
					"/v1/tools/search",
					{ query: params.query, count: params.count ?? 10 },
					signal,
				);

				const results = data.results ?? [];
				const text = results.length
					? results
							.map((r, i) => {
								const meta = [r.date?.slice(0, 10), r.url].filter(Boolean).join(" · ");
								const body = (r.summary || r.snippet || "").replace(/\s+/g, " ").trim();
								return `${i + 1}. ${r.title ?? r.url}\n   ${meta}\n   ${body}`;
							})
							.join("\n\n")
					: "No results.";

				return { content: [{ type: "text", text }], details: undefined };
			},
		}),
	);

	pi.registerTool(
		defineTool({
			name: "web_fetch",
			label: "Web Fetch",
			description: "Fetch one http(s) URL with DeepSeek and return it as Markdown.",
			parameters: Type.Object({
				url: Type.String({ description: "Absolute http(s) URL" }),
			}),
			async execute(_toolCallId, params, signal) {
				const page = await post<{ title?: string; content?: string }>("/v1/tools/fetch", { url: params.url }, signal);
				const content = page.content?.trim();
				if (!content) throw new Error(`DeepSeek returned no content for ${params.url}`);

				const text = `${page.title ? `# ${page.title}\n\n` : ""}${content}`;
				return { content: [{ type: "text", text }], details: undefined };
			},
		}),
	);
}
