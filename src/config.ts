import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { MicroserviceConfig, ScheduleTask } from './types';

// Load environment variables from .env file
dotenv.config();

// Simple path resolver for credentials file
const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH 
  ? path.resolve(process.cwd(), process.env.GOOGLE_CREDENTIALS_PATH)
  : path.join(__dirname, '../env/gdrive-bets-9e3ae1412e88.json');


// Check if credentials file exists, but don't throw an error if it doesn't
const hasCredentials = fs.existsSync(credentialsPath);
if (!hasCredentials && process.env.NODE_ENV !== 'development') {
  console.warn(`Warning: Google credentials file not found at: ${credentialsPath}`);
  console.warn('Google Sheets functionality will not be available.');
}

const microservices: MicroserviceConfig[] = [
  {
    name: 'games',
    file: './microservices/games.ts',
    port: 3000,
    retries: 0,
    startManually: true,
  },
  {
    name: 'users',
    file: './microservices/users.ts',
    port: 3001,
    retries: 0
  },
  {
    name: 'ui',
    file: './microservices/ui.ts',
    port: 3002,
    retries: 0,
    startManually: true,
  },
];

// Scheduled tasks configuration
const schedule: ScheduleTask[] = [
  {
    milliseconds: 4 * 60 * 60 * 1000,
    microservice: 'games',
    endpoint: '/fetch-nfl-data',
  },
  {
    milliseconds: 30 * 1000, // Sync both games and bets every 30 seconds
    microservice: 'ui',
    endpoint: '/sync-ui',
  },
];

// Simple config object with properties for each env variable
const config = {
  // Server
  port: process.env.PORT || '80',
  nodeEnv: process.env.NODE_ENV || 'production',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',
  
  // Google Sheets
  credentials: hasCredentials ? JSON.parse(fs.readFileSync(credentialsPath, 'utf8')) : null,
  spreadsheetId: process.env.SPREADSHEET_ID || '',
  
  // Odds API
  oddsApiUrl: process.env.ODDS_API_URL || '',
  oddsApiKey: process.env.ODDS_API_KEY || '',
  oddsSport: process.env.ODDS_SPORT || '',
  oddsRegions: process.env.ODDS_REGIONS || '',

  // Orchestration
  microservices,
  schedule,
};

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}



export default config;
