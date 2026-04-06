import { defineCommand } from "citty";
import { loadCredentials } from "../../cloud/credentials.ts";

export const whoami = defineCommand({
	meta: { name: "whoami", description: "Show current user and tenant" },
	run: async () => {
		const creds = await loadCredentials();
		if (!creds) {
			console.log("Not logged in. Run: mantle cloud login");
			process.exit(1);
		}
		console.log(`${creds.email} (tenant: ${creds.tenant})`);
	},
});
