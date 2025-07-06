
import config from './config';
import { startScheduler } from './services/schedulerService';
import { 
  initializeAndStartServices, 
  shutdownAll,
  getServicePortMap 
} from './services/orchestrationService';

process.on('SIGINT', shutdownAll);
process.on('SIGTERM', shutdownAll);
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  shutdownAll();
});

initializeAndStartServices(config.microservices);

console.log('Scheduler will start in 5 seconds...');
setTimeout(() => {
  const servicePortMap = getServicePortMap(config.microservices);
  startScheduler(config.schedule, servicePortMap);
}, 5000);
