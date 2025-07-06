# gdrive-bets

A TypeScript Express.js application with Google Sheets integration for data management.

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
│       ├── googleSheetsService.ts  # Google Sheets integration
│       ├── nflDataService.ts       # NFL data service
│       ├── orchestrationService.ts # Microservice orchestration
│       ├── schedulerService.ts     # Task scheduling service
│       └── uiService.ts            # UI service
├── env/                # Environment configuration
│   └── gdrive-bets-9e3ae1412e88.json  # Google service account credentials
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

## Google Sheets Integration

This application features a two-way integration with Google Sheets:

1. **Download data from Google Sheets to CSV**
   - Script: `src/scripts/google-sheets-to-csv.ts`
   - Command: `npm run sheets-to-csv`

2. **Upload data from CSV back to Google Sheets**
   - Script: `src/scripts/update-sheet.ts`
   - Command: `npm run csv-to-sheet`

### Authentication Setup

1. **Service Account Authentication (Used in this project)**
   - The project uses a Google service account with the email: `gdrive-bets@gdrive-bets.iam.gserviceaccount.com`
   - Credentials are stored in: `/env/gdrive-bets-9e3ae1412e88.json`
   - The spreadsheet ID is: `1ozElsXHgzUwRq-tLMJMjIrDB_k0D5Emyur63ckXgLaQ`
   - The spreadsheet must be shared with the service account email with Editor access

2. **Configuration**
   - The following environment variables are used for Google Sheets integration:
     ```
     GOOGLE_CREDENTIALS_PATH="./env/gdrive-bets-9e3ae1412e88.json"
     SPREADSHEET_ID="1ozElsXHgzUwRq-tLMJMjIrDB_k0D5Emyur63ckXgLaQ"
     SHEET_NAME="Sheet1"
     OUTPUT_CSV_PATH="./output.csv"
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

# Run in development mode with auto-reload
npm run dev

# Run in development mode with microservices
npm run dev:microservices
```

### Database Configuration
Set your PostgreSQL database connection string in the `.env` file:
```
DATABASE_URL="postgresql://username:password@localhost:5432/gdrive_bets?schema=public"
```
