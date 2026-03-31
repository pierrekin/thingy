/**
 * Thin wrapper around the restic CLI binary.
 */

export class ResticError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ResticError";
  }
}

export class ResticBinaryError extends ResticError {
  constructor(message: string) {
    super("binary_error", message);
    this.name = "ResticBinaryError";
  }
}

export class ResticRepoError extends ResticError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "ResticRepoError";
  }
}

export type ResticConfig = {
  repository: string;
  password?: string;
  passwordFile?: string;
  env?: Record<string, string>;
};

export type ResticSnapshot = {
  id: string;
  time: string; // ISO 8601
  hostname: string;
  tags: string[] | null;
  paths: string[];
};

export class ResticClient {
  constructor(private config: ResticConfig) {}

  /**
   * Get the latest snapshot, optionally filtered by host and/or tags.
   */
  async getLatestSnapshot(options?: {
    host?: string;
    tags?: string[];
  }): Promise<ResticSnapshot | null> {
    const args = ["snapshots", "--json", "--latest", "1"];

    if (options?.host) {
      args.push("--host", options.host);
    }
    if (options?.tags?.length) {
      for (const tag of options.tags) {
        args.push("--tag", tag);
      }
    }

    const snapshots = await this.exec<ResticSnapshot[]>(args);
    return snapshots[0] ?? null;
  }

  private buildEnv(): Record<string, string> {
    const env: Record<string, string> = {
      ...this.config.env,
      RESTIC_REPOSITORY: this.config.repository,
    };

    if (this.config.password) {
      env.RESTIC_PASSWORD = this.config.password;
    }
    if (this.config.passwordFile) {
      env.RESTIC_PASSWORD_FILE = this.config.passwordFile;
    }

    return env;
  }

  private async exec<T>(args: string[]): Promise<T> {
    let proc: Awaited<ReturnType<typeof Bun.spawn>>;

    try {
      proc = Bun.spawn(["restic", ...args], {
        env: { ...process.env, ...this.buildEnv() },
        stdout: "pipe",
        stderr: "pipe",
      });
    } catch (err) {
      throw new ResticBinaryError(
        `Failed to spawn restic: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      // Distinguish repo-level errors from other failures
      if (
        stderr.includes("wrong password") ||
        stderr.includes("unable to open config")
      ) {
        throw new ResticRepoError("repo_access", `Cannot access repository: ${stderr.trim()}`);
      }
      if (
        stderr.includes("connection refused") ||
        stderr.includes("no such host") ||
        stderr.includes("timeout")
      ) {
        throw new ResticRepoError("repo_unreachable", `Repository unreachable: ${stderr.trim()}`);
      }
      throw new ResticError("command_failed", `restic ${args[0]} failed (exit ${exitCode}): ${stderr.trim()}`);
    }

    try {
      return JSON.parse(stdout) as T;
    } catch {
      throw new ResticError("parse_error", `Failed to parse restic output: ${stdout.slice(0, 200)}`);
    }
  }
}
