import { watch } from "node:fs";

const WIKI_DIR = "/Users/deepak-macmini/honeybloom/library/wiki";

export function GET() {
	let closed = false;

	const stream = new ReadableStream({
		start(controller) {
			function safeEnqueue(data: string) {
				if (closed) return;
				try {
					controller.enqueue(`data: ${data}\n\n`);
				} catch {}
			}

			safeEnqueue("connected");

			let debounceTimer: ReturnType<typeof setTimeout> | null = null;

			const watcher = watch(WIKI_DIR, (eventType, filename) => {
				if (!filename?.endsWith(".md")) return;
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					safeEnqueue(JSON.stringify({ type: "wiki_update", file: filename }));
				}, 200);
			});

			const cleanup = () => {
				closed = true;
				watcher.close();
				if (debounceTimer) clearTimeout(debounceTimer);
			};

			// @ts-ignore
			controller.signal?.addEventListener("abort", cleanup);
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
}
