import { readFile, mkdir } from "node:fs/promises";

export type Credentials = {
	token: string;
	email: string;
	tenant: string;
};

const CREDENTIALS_DIR = `${process.env.HOME}/.mantle`;
const CREDENTIALS_PATH = `${CREDENTIALS_DIR}/credentials.json`;

export async function loadCredentials(): Promise<Credentials | null> {
	try {
		const content = await readFile(CREDENTIALS_PATH, "utf-8");
		return JSON.parse(content) as Credentials;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			return null;
		}
		throw err;
	}
}

export async function saveCredentials(creds: Credentials): Promise<void> {
	await mkdir(CREDENTIALS_DIR, { recursive: true });
	await Bun.write(CREDENTIALS_PATH, JSON.stringify(creds, null, 2) + "\n");
}
