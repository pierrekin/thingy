import { defineCommand } from "citty";
import { getCloudUrl } from "../../cloud/config.ts";

function getCallbackPort(): number {
	// Random port in the ephemeral range
	return 49152 + Math.floor(Math.random() * 16383);
}

function startCallbackServer(port: number): Promise<{ token: string; email: string; tenant: string }> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			server.stop();
			reject(new Error("Login timed out after 120 seconds"));
		}, 120_000);

		const server = Bun.serve({
			port,
			fetch(req) {
				const url = new URL(req.url);

				if (url.pathname === "/callback") {
					const token = url.searchParams.get("token");
					const email = url.searchParams.get("email");
					const tenant = url.searchParams.get("tenant");

					if (!token || !email || !tenant) {
						return new Response("Missing parameters", { status: 400 });
					}

					clearTimeout(timeout);
					server.stop();
					resolve({ token, email, tenant });

					return new Response(
						"<html><body><h2>Logged in! You can close this tab.</h2></body></html>",
						{ headers: { "Content-Type": "text/html" } },
					);
				}

				return new Response("Not found", { status: 404 });
			},
		});
	});
}

async function openBrowser(url: string): Promise<void> {
	const proc = Bun.spawn(["open", url], { stdio: ["ignore", "ignore", "ignore"] });
	await proc.exited;
}

import { saveCredentials } from "../../cloud/credentials.ts";

export const login = defineCommand({
	meta: { name: "login", description: "Log in to Mantle Cloud" },
	run: async () => {
		const port = getCallbackPort();
		const callbackUrl = `http://localhost:${port}/callback`;
		const loginUrl = `${getCloudUrl()}/authorize-cli?callback=${encodeURIComponent(callbackUrl)}`;

		console.log("Opening browser to log in...");

		const resultPromise = startCallbackServer(port);
		await openBrowser(loginUrl);

		const { token, email, tenant } = await resultPromise;

		await saveCredentials({ token, email, tenant });
		console.log(`Logged in as ${email} (tenant: ${tenant})`);
	},
});
