type StreamFor<T> = T extends "pipe" ? ReadableStream<Uint8Array> : undefined;

type SpawnOpts = Parameters<typeof Bun.spawn>[1];

type TypedSubprocess<O> = Omit<
  ReturnType<typeof Bun.spawn>,
  "stdout" | "stderr"
> & {
  stdout: StreamFor<O extends { stdout: infer S } ? S : undefined>;
  stderr: StreamFor<O extends { stderr: infer S } ? S : undefined>;
};

/**
 * Typed wrapper around Bun.spawn that narrows stdout/stderr based on input
 * options. Passing stdout: "pipe" yields a ReadableStream; other options
 * yield undefined.
 */
export function spawn<const O extends SpawnOpts>(
  cmd: string[],
  opts: O,
): TypedSubprocess<O> {
  return Bun.spawn(cmd, opts) as TypedSubprocess<O>;
}
