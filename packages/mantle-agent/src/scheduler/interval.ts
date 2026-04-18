import type { ScheduledTask, Scheduler } from "./types.ts";

type RunningTask = {
  task: ScheduledTask;
  timer: ReturnType<typeof setInterval> | null;
  inFlight: Promise<void> | null;
};

/**
 * Simple interval-based scheduler.
 * Each task runs on its own setInterval.
 */
export class IntervalScheduler implements Scheduler {
  private tasks = new Map<string, RunningTask>();
  private running = false;

  add(task: ScheduledTask): void {
    if (this.tasks.has(task.id)) {
      throw new Error(`Task '${task.id}' already exists`);
    }

    const runningTask: RunningTask = {
      task,
      timer: null,
      inFlight: null,
    };

    this.tasks.set(task.id, runningTask);

    if (this.running) {
      this.startTask(runningTask);
    }
  }

  remove(id: string): void {
    const runningTask = this.tasks.get(id);
    if (!runningTask) return;

    if (runningTask.timer) {
      clearInterval(runningTask.timer);
    }

    this.tasks.delete(id);
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    for (const runningTask of this.tasks.values()) {
      this.startTask(runningTask);
    }
  }

  async stop(): Promise<void> {
    this.running = false;

    // Clear all timers
    for (const runningTask of this.tasks.values()) {
      if (runningTask.timer) {
        clearInterval(runningTask.timer);
        runningTask.timer = null;
      }
    }

    // Wait for in-flight tasks
    const inFlight = [...this.tasks.values()]
      .map((t) => t.inFlight)
      .filter((p): p is Promise<void> => p !== null);

    await Promise.all(inFlight);
  }

  private startTask(runningTask: RunningTask): void {
    const { task } = runningTask;

    // Run immediately on start
    this.runTask(runningTask);

    // Then run on interval
    runningTask.timer = setInterval(() => {
      this.runTask(runningTask);
    }, task.interval);
  }

  private runTask(runningTask: RunningTask): void {
    // Skip if previous run still in flight
    if (runningTask.inFlight) return;

    runningTask.inFlight = runningTask.task
      .run()
      .catch((err) => {
        console.error(`Task '${runningTask.task.id}' failed:`, err);
      })
      .finally(() => {
        runningTask.inFlight = null;
      });
  }
}
