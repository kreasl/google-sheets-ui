import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import UsersService from '../services/usersService';

const app = express();
const PORT = process.env.PORT || 3001;

const usersService = new UsersService();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../../public')));

app.get('/', (req, res) => {
  res.json({ service: 'users', message: 'Users microservice is running' });
});

app.post('/bet', async (req, res) => {
  try {
    console.log('Received bet request:', req.body);
    const { userName, gameName, gameDateTime, outcomeType, amount, bookmakerName, marketCode } = req.body;
    
    const result = await usersService.createOrUpdateBet(
      userName,
      gameName,
      gameDateTime,
      outcomeType,
      amount,
      bookmakerName,
      marketCode
    );

    res.status(201).json({
      service: 'users',
      message: result.isNew ? 'Bet created successfully' : 'Bet updated successfully',
      bet: result.bet
    });
  } catch (error: any) {
    console.error('Error creating bet:', error);
    res.status(500).json({
      service: 'users',
      message: 'Error creating bet',
      error: error.message
    });
  }
});

app.post('/results', async (req, res) => {
  try {
    const { userName } = req.body;

    const results = await usersService.getUserResults(userName);

    console.log(`${userName} placed ${results.bets.length} bets`);
    
    res.json({
      service: 'users',
      userName: results.userName,
      bets: results.bets
    });
  } catch (error: any) {
    console.error('Error fetching user bets:', error);
    res.status(500).json({
      service: 'users',
      message: 'Error fetching user bets',
      error: error.message
    });
  }
});

process.on('SIGTERM', async () => {
  console.log('Users service received SIGTERM signal, shutting down gracefully');
  await usersService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Users service received SIGINT signal, shutting down gracefully');
  await usersService.disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Users service is running on port ${PORT}`);
});
