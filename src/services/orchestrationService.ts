import { fork, spawn, ChildProcess } from 'child_process';
import path from 'path';
import { existsSync } from 'fs';
import { ProcessInfo, MicroserviceConfig } from '../types';
import { stopScheduler } from './schedulerService';
import config from '../config';

const MAX_RETRIES = 3;
const processes: ProcessInfo[] = [];
let shuttingDown = false;

export function startService(processInfo: ProcessInfo): void {
  if (processInfo.process) {
    console.log(`${processInfo.name} service is already running`);
    return;
  }
  
  console.log(`Starting ${processInfo.name} service on port ${processInfo.config.port}...`);
  
  const filePath = path.resolve(__dirname, '..', processInfo.config.file);
  
  const isDev = process.env.NODE_ENV === 'development' || !existsSync(filePath.replace('.ts', '.js'));
  let childProcess: ChildProcess;
  
  if (isDev) {
    childProcess = spawn('npx', ['ts-node', filePath], {
      env: { ...process.env, PORT: processInfo.config.port.toString() },
      stdio: 'inherit'
    });
  } else {
    const jsFilePath = filePath.replace('.ts', '.js');
    childProcess = fork(jsFilePath, [], {
      env: { ...process.env, PORT: processInfo.config.port.toString() }
    });
  }
  
  processInfo.process = childProcess;
  
  childProcess.on('exit', (code, signal) => {
    console.log(`${processInfo.name} service exited with code ${code} and signal ${signal}`);
    processInfo.process = null;
    
    if (shuttingDown) return;
    
    if (processInfo.retries < MAX_RETRIES) {
      console.log(`Restarting ${processInfo.name} service (retry ${processInfo.retries + 1}/${MAX_RETRIES})...`);
      processInfo.retries++;
      startService(processInfo);
    } else {
      console.error(`${processInfo.name} service failed after ${MAX_RETRIES} retries. Shutting down all services.`);
      shutdownAll();
    }
  });
  
  childProcess.on('error', (err) => {
    console.error(`${processInfo.name} service error:`, err);
  });
}

export function shutdownAll(): void {
  if (shuttingDown) return;
  setShuttingDown(true);
  
  console.log('Shutting down all services...');
  
  stopScheduler(config.schedule);
  
  processes.forEach(processInfo => {
    if (processInfo.process) {
      console.log(`Stopping ${processInfo.name} service...`);
      processInfo.process.kill('SIGTERM');
    }
  });
  
  setTimeout(() => {
    console.log('Shutdown complete.');
    process.exit(1);
  }, 5000);
}

export function initializeAndStartServices(microservices: MicroserviceConfig[]): ProcessInfo[] {
  // Initialize process tracking
  microservices.forEach(service => {
    processes.push({
      process: null,
      retries: 0,
      name: service.name,
      config: service
    });
  });
  
  // Start services that don't have startManually flag
  processes
    .filter(p => !microservices.find(m => m.name === p.name)?.startManually)
    .forEach(startService);
    
  console.log('All auto-start services initialized and started.');
  return processes;
}

export function getServicePortMap(microservices: MicroserviceConfig[]): Map<string, number> {
  const servicePortMap = new Map<string, number>();
  microservices.forEach(service => {
    servicePortMap.set(service.name, service.port);
  });
  return servicePortMap;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function setShuttingDown(value: boolean): void {
  shuttingDown = value;
}
