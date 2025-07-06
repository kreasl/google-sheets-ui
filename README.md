# gdrive-bets

A TypeScript Express.js application with Google Sheets integration and NFL data fetching for data management.

## Project Structure
```
gdrive-bets/
├── src/                # Source code directory
│   ├── app.ts          # Main application entry point
│   ├── config.ts       # Configuration settings
│   ├── types.ts        # TypeScript type definitions
│   ├── microservices/  # Microservice implementations
│   │   ├── games.ts    # Games microservice
│   │   ├── users.ts    # Users microservice
│   │   └── ui.ts       # UI microservice
│   └── services/       # Service implementations
│       ├── gamesService.ts       # Games service
│       ├── googleSheetsService.ts  # Google Sheets service
│       ├── nflDataService.ts       # NFL data service
│       ├── orchestrationService.ts # Orchestration service
│       ├── schedulerService.ts     # Scheduler service
│       ├── uiService.ts            # UI service
│       └── usersService.ts         # Users service
├── env/                # Environment configuration
│   └── %GOOGLE_CLOUD_SERVICE_ACCOUNT_CREDENTIALS%.json  # Google service account credentials
├── package.json        # Project dependencies and scripts
└── .env                # Environment variables
```

## Getting Started

### Prerequisites
- Node.js (v22 or higher)
- npm (v10 or higher)
- PostgreSQL database

### Installation
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the server in development mode
npm run dev:microservices
```

The application runs multiple microservices on different ports:
- Games microservice: Port 3000
- Users microservice: Port 3001
- UI microservice: Port 3002

### Configuration
Create a Google Cloud Service Account and download the credentials JSON file.
Share your Spreadsheet with the service account email with Editor access.

Register to Odds API and get an API key.

Set the following environment variables:
  ```
  GOOGLE_CREDENTIALS_PATH="./env/%GOOGLE_CLOUD_SERVICE_ACCOUNT_CREDENTIALS%.json"
  SPREADSHEET_ID="%SPREADSHEET_ID%"
  ODDS_API_KEY="%ODDS_API_KEY%"
  ```

## Other Features

### NFL Data Integration
- Fetch NFL data: `npm run fetch-nfl`
- Generate game results: `npm run generate-game-results`

### User and Bet Management
- Generate users: `npm run generate-users`
- Generate bets: `npm run generate-bets`
- Generate results: `npm run generate-results`

## Development

### Available Scripts
```bash
# Build the TypeScript code
npm run build

# Start the production server
npm start

# Run in development mode with microservices
npm run dev:microservices
```

### Database Configuration
Set your PostgreSQL database connection string in the `.env` file:
```
DATABASE_URL="postgresql://username:password@localhost:5432/gdrive_bets?schema=public"
```
