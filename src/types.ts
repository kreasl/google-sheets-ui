import { ChildProcess } from "child_process";

export interface MicroserviceConfig {
  name: string;
  file: string;
  port: number;
  retries: number;
  startManually?: boolean;
}

export interface ProcessInfo {
  process: ChildProcess | null;
  retries: number;
  name: string;
  config: MicroserviceConfig;
}

export interface ScheduleTask {
  milliseconds: number;
  microservice: string;
  endpoint: string;
  timeoutId?: NodeJS.Timeout;
}