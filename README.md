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

### Installation and running
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

Create a Google Spreadsheet with the following sheets:
- Games
- Bets
- Results

Share your Spreadsheet with the service account email (get the email from the JSON file) with Editor access.

Register to Odds API and get an API key.

Set the following environment variables:
  ```
  GOOGLE_CREDENTIALS_PATH="./env/%GOOGLE_CLOUD_SERVICE_ACCOUNT_CREDENTIALS%.json"
  SPREADSHEET_ID="%SPREADSHEET_ID%"
  ODDS_API_KEY="%ODDS_API_KEY%"
  ```

### Usage

Run the application:
```bash
npm run dev:microservices
```

The application will start and run in development mode. The microservices will be available at the following URLs:
- Games microservice: http://localhost:3000
- Users microservice: http://localhost:3001
- UI microservice: http://localhost:3002

Wait for the NFL games to be fetched and stored in the database. This can take several seconds

or you can call the following endpoint to fetch the NFL games:
```bash
GET http://localhost:3000/games/fetch
```

Generate random results for the games:
```bash
POST http://localhost:3000/games/generate-results
```

Now you should see the games and available odds in your Google Spreadsheet in the "Games" sheet.

You can also see, edit and add the bets in the "Bets" sheet.

You can see the user results in the "Results" sheet.

You can also use sevaral endpoints to manage the users and bets.
- POST http://localhost:3001/bet   - add new bet
- POST http://localhost:3001/results    - get user results (by name)
- GET http://localhost:3002/sync-ui    - sync the Google Sheets UI