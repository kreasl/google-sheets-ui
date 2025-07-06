import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { MicroserviceConfig, ScheduleTask } from './types';

dotenv.config();

const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH 
  ? path.resolve(process.cwd(), process.env.GOOGLE_CREDENTIALS_PATH)
  : path.join(__dirname, '../env/gdrive-bets-9e3ae1412e88.json');

const hasCredentials = fs.existsSync(credentialsPath);
if (!hasCredentials && process.env.NODE_ENV !== 'development') {
  console.warn(`Warning: Google credentials file not found at: ${credentialsPath}`);
  console.warn('Google Sheets functionality will not be available.');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const microservices: MicroserviceConfig[] = [
  {
    name: 'games',
    file: 'games.ts',
    port: Number(process.env.GAMES_PORT || 3000),
    retries: 0,
  },
  {
    name: 'users',
    file: 'users.ts',
    port: Number(process.env.USERS_PORT || 3001),
    retries: 0
  },
  {
    name: 'ui',
    file: 'ui.ts',
    port: Number(process.env.UI_PORT || 3002),
    retries: 0,
  },
];

const schedule: ScheduleTask[] = [
  {
    milliseconds: Number(process.env.SCHEDULE_GAMES) || 4 * 60 * 60 * 1000,
    microservice: 'games',
    endpoint: '/fetch-nfl-data',
  },
  {
    milliseconds: Number(process.env.SCHEDULE_UI) || 30 * 1000,
    microservice: 'ui',
    endpoint: '/sync-ui',
  },
];

const config = {
  port: process.env.PORT || '80',
  nodeEnv: process.env.NODE_ENV || 'production',

  databaseUrl: process.env.DATABASE_URL || '',
  
  credentials: hasCredentials ? JSON.parse(fs.readFileSync(credentialsPath, 'utf8')) : null,
  spreadsheetId: process.env.SPREADSHEET_ID || '',
  
  oddsApiUrl: process.env.ODDS_API_URL || '',
  oddsApiKey: process.env.ODDS_API_KEY || '',
  oddsSport: process.env.ODDS_SPORT || '',
  oddsRegions: process.env.ODDS_REGIONS || '',

  microservices,
  schedule,
};

export default config;
