import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import GamesService from '../services/gamesService';

const app = express();
const PORT = process.env.PORT || 3000;

const gamesService = new GamesService();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../../public')));

app.get('/', (req, res) => {
  res.json({ service: 'games', message: 'Games microservice is running' });
});

app.get('/fetch-nfl-data', async (req, res) => {
  try {
    console.log('Fetch NFL data endpoint called');
    const result = await gamesService.fetchNflData();
    
    console.log('Data import completed successfully');
    res.json({ 
      success: true, 
      message: `Successfully processed ${result.processedGames} games` 
    });
  } catch (error: any) {
    console.error('Error fetching or storing NFL data:', error);
    if (error.response) {
      console.error('API response error:', error.response.data);
    }
    res.status(500).json({ success: false, error: 'Failed to fetch and process NFL data' });
  }
});

app.post('/generate-results', async (req, res) => {
  try {
    console.log('Generate results endpoint called');
    const result = await gamesService.generateResults();
    
    if (result.processedGames === 0) {
      return res.json({ success: true, message: 'No games found' });
    }
    
    console.log('All game results generated/updated successfully');
    res.json({ 
      success: true, 
      message: `Successfully generated/updated results for ${result.processedGames} games` 
    });
  } catch (error) {
    console.error('Error generating game results:', error);
    res.status(500).json({ success: false, error: 'Failed to generate game results' });
  }
});

process.on('SIGTERM', async () => {
  console.log('Games service received SIGTERM signal, shutting down gracefully');
  await gamesService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Games service received SIGINT signal, shutting down gracefully');
  await gamesService.disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Games service is running on port ${PORT}`);
});
