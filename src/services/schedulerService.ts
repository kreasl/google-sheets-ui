import { ScheduleTask } from "../types";
import { isShuttingDown } from "./orchestrationService";

export async function executeScheduledTask(task: ScheduleTask, servicePortMap: Map<string, number>): Promise<void> {
  if (isShuttingDown()) return;
  
  const { microservice, endpoint } = task;
  
  const port = servicePortMap.get(microservice);
  
  if (!port) {
    console.error(`Scheduled task error: Microservice '${microservice}' not found`);
    return;
  }
  
  const url = `http://localhost:${port}${endpoint}`;
  
  try {
    console.log(`Executing scheduled task: GET ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Scheduled task error: ${response.status} ${response.statusText} for ${url}`);
      return;
    }
    
    console.log(`Scheduled task completed: ${url} - Status: ${response.status}`);
  } catch (error) {
    console.error(`Scheduled task failed: ${url}`, error);
  }
}

export async function scheduleRecurringTask(
  task: ScheduleTask, 
  servicePortMap: Map<string, number>
): Promise<void> {
  if (isShuttingDown()) return;
  
  await executeScheduledTask(task, servicePortMap);
  
  if (!isShuttingDown()) {
    task.timeoutId = global.setTimeout(() => {
      scheduleRecurringTask(task, servicePortMap).catch(error => {
        console.error(`Recurring task error for ${task.microservice}${task.endpoint}:`, error);
      });
    }, task.milliseconds);
  }
}

export function startScheduler(tasks: ScheduleTask[], servicePortMap: Map<string, number>): void {
  console.log(`Starting scheduler with ${tasks.length} tasks`);
  
  tasks.forEach(task => {
    console.log(`Scheduling task: ${task.microservice}${task.endpoint} every ${task.milliseconds}ms`);
    scheduleRecurringTask(task, servicePortMap).catch(error => {
      console.error('Scheduler error:', error);
    });
  });
}

export function stopScheduler(tasks: ScheduleTask[]): void {
  console.log('Stopping scheduled tasks...');
  
  tasks.forEach(task => {
    if (task.timeoutId) {
      clearTimeout(task.timeoutId);
      console.log(`Stopped scheduled task: ${task.microservice}${task.endpoint}`);
    }
  });
}
