export type ScheduledTask = {
  id: string;
  interval: number; // ms
  run: () => Promise<void>;
};

export interface Scheduler {
  add(task: ScheduledTask): void;
  remove(id: string): void;
  start(): void;
  stop(): Promise<void>;
}
