import { defineCommand } from "citty";
import { unlink } from "node:fs/promises";

const CREDENTIALS_PATH = `${process.env.HOME}/.mantle/credentials.json`;

export const logout = defineCommand({
	meta: { name: "logout", description: "Log out of Mantle Cloud" },
	run: async () => {
		try {
			await unlink(CREDENTIALS_PATH);
			console.log("Logged out.");
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				console.log("Not logged in.");
			} else {
				throw err;
			}
		}
	},
});
