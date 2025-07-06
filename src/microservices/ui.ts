import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import UiService from '../services/uiService';

const app = express();
const PORT = process.env.PORT || 3002;

const uiService = new UiService();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../../public')));

app.get('/', (req, res) => {
  res.json({ service: 'ui', message: 'UI microservice is running' });
});

app.get('/sync-ui', async (req, res) => {
  console.log('Sync-UI endpoint called - syncing both games and bets');
  
  try {
    console.log('Step 1: Syncing games to Google Sheets...');
    const gamesRowsWritten = await uiService.syncGamesToGoogleSheets();
    console.log(`Successfully wrote ${gamesRowsWritten} game rows to Google Sheets`);
    
    console.log('Step 2: Syncing bets from Google Sheets to database...');
    const betsResult = await uiService.syncBetsFromGoogleSheets();
    console.log(`Processed ${betsResult.total} bets: ${betsResult.valid} valid, ${betsResult.invalid} invalid, ${betsResult.added} added to sheet`);
    
    console.log('Step 3: Syncing user results to Google Sheets...');
    const userResultsCount = await uiService.syncUserResultsToGoogleSheets();
    console.log(`Wrote results for ${userResultsCount} users to the Results sheet`);
    
    res.json({ 
      service: 'ui', 
      message: 'UI state synced successfully (games, bets, and user results)', 
      games: {
        rowsWritten: gamesRowsWritten
      },
      bets: {
        processed: betsResult.total,
        valid: betsResult.valid,
        invalid: betsResult.invalid,
        added: betsResult.added
      },
      userResults: {
        usersProcessed: userResultsCount
      }
    });
  } catch (error: any) {
    console.error('Error in sync-ui endpoint:', error);
    res.status(500).json({ 
      service: 'ui', 
      message: 'Error syncing UI state', 
      error: error.message 
    });
  }
});

process.on('SIGTERM', async () => {
  console.log('UI service received SIGTERM signal, shutting down gracefully');
  await uiService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('UI service received SIGINT signal, shutting down gracefully');
  await uiService.disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`UI service is running on port ${PORT}`);
});
