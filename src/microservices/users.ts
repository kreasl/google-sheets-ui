import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import config from '../config';

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Prisma client
const prisma = new PrismaClient({
  datasources: {
    db: { url: config.databaseUrl },
  },
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ service: 'users', message: 'Users microservice is running' });
});

// Add a bet for a user
app.post('/bets', async (req, res) => {
  try {
    console.log('Received bet request:', req.body);
    const { userName, gameName, gameDateTime, outcomeType, amount, bookmakerName, marketCode } = req.body;
    
    // Validate required fields
    if (!userName || !gameName || !gameDateTime || !outcomeType || !amount || !bookmakerName || !marketCode) {
      return res.status(400).json({
        service: 'users',
        message: 'Missing required fields',
        requiredFields: ['userName', 'gameName', 'gameDateTime', 'oddType', 'amount', 'bookmakerName', 'marketCode']
      });
    }
    
    // Parse gameDateTime (required field)
    let gameDateObj: Date;
    try {
      gameDateObj = new Date(gameDateTime);
      if (isNaN(gameDateObj.getTime())) {
        return res.status(400).json({
          service: 'users',
          message: 'Invalid gameDateTime format. Please provide a valid ISO date string.'
        });
      }
    } catch (error) {
      return res.status(400).json({
        service: 'users',
        message: 'Invalid gameDateTime format. Please provide a valid ISO date string.'
      });
    }

    // Validate oddType
    if (!['home_win', 'away_win', 'draw'].includes(outcomeType)) {
      return res.status(400).json({
        service: 'users',
        message: 'Invalid oddType value',
        validValues: ['home_win', 'away_win', 'draw']
      });
    }

    // Check if user exists by name, or create a new one
    let user = await prisma.user.findFirst({
      where: { name: userName }
    });

    // If user doesn't exist, create a new one
    if (!user) {
      console.log(`Creating new user with name: ${userName}`);
      user = await prisma.user.create({
        data: {
          name: userName
        } as any // Using type assertion to bypass TypeScript error
      });
      console.log(`Created new user:`, user);
    }

    // Parse game name to extract home and away team names
    const gameNameParts = gameName.split(' vs. ');
    if (gameNameParts.length !== 2) {
      return res.status(400).json({
        service: 'users',
        message: 'Invalid game name format. Expected format: "Home Team vs. Away Team"'
      });
    }
    
    const [homeTeamName, awayTeamName] = gameNameParts;
    
    // Find teams by name
    const homeTeam = await prisma.team.findUnique({
      where: { name: homeTeamName }
    });
    
    const awayTeam = await prisma.team.findUnique({
      where: { name: awayTeamName }
    });
    
    if (!homeTeam || !awayTeam) {
      return res.status(404).json({
        service: 'users',
        message: `Team not found: ${!homeTeam ? homeTeamName : awayTeamName}`
      });
    }
    
    // Build the game query based on teams and optional datetime
    const gameQuery: any = {
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id
    };
    
    // Find the game closest to the provided gameDateTime
    let game;
    
    // Find all games matching the teams
    const games = await prisma.game.findMany({
      where: gameQuery,
      orderBy: {
        commenceTime: 'asc'
      }
    });
    
    if (games.length === 0) {
      return res.status(404).json({
        service: 'users',
        message: `Game '${gameName}' not found`
      });
    }
    
    // Find the game with the closest commenceTime to the provided gameDateTime
    game = games.reduce((closest, current) => {
      const closestDiff = Math.abs(closest.commenceTime.getTime() - gameDateObj.getTime());
      const currentDiff = Math.abs(current.commenceTime.getTime() - gameDateObj.getTime());
      return currentDiff < closestDiff ? current : closest;
    }, games[0]);
    
    console.log(`Selected game with commenceTime ${game.commenceTime} based on provided gameDateTime ${gameDateObj}`);


    // Check if bookmaker exists by name
    const bookmaker = await prisma.bookmaker.findFirst({
      where: { title: bookmakerName }
    });

    if (!bookmaker) {
      return res.status(404).json({
        service: 'users',
        message: `Bookmaker with name '${bookmakerName}' not found`
      });
    }

    // Check if market exists by code
    const market = await prisma.market.findUnique({
      where: { key: marketCode }
    });

    if (!market) {
      return res.status(404).json({
        service: 'users',
        message: `Market with code '${marketCode}' not found`
      });
    }

    // Check if bet already exists for this user and game
    const existingBet = await prisma.bet.findFirst({
      where: {
        userId: user.id,
        gameId: game.id
      }
    });

    let bet;
    if (existingBet) {
      // Update existing bet
      const updateData: any = {
        amount: parseFloat(amount),
        oddType: outcomeType,
        bookmakerId: bookmaker.id,
        marketId: market.id
      };
      
      bet = await prisma.bet.update({
        where: { id: existingBet.id },
        data: updateData
      });
    } else {
      // Create new bet
      const createData: any = {
        userId: user.id,
        gameId: game.id,
        oddType: outcomeType,
        amount: parseFloat(amount),
        bookmakerId: bookmaker.id,
        marketId: market.id
      };
      
      bet = await prisma.bet.create({
        data: createData
      });
    }

    res.status(201).json({
      service: 'users',
      message: existingBet ? 'Bet updated successfully' : 'Bet created successfully',
      bet
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

// Get user bets by username
app.post('/results', async (req, res) => {
  try {
    const { userName } = req.body;
    
    // Find user by name
    const user = await prisma.user.findFirst({
      where: { name: userName }
    });
    
    if (!user) {
      return res.status(404).json({
        service: 'users',
        message: `User with name '${userName}' not found`
      });
    }
    
    // Get all bets for the user with related data
    const bets = await prisma.bet.findMany({
      where: { userId: user.id },
      include: {
        game: {
          include: {
            homeTeam: true,
            awayTeam: true,
            result: true,
            odds: true,
          }
        },
        bookmaker: true,
        market: true,
      },
    });
    
    // Format the response with required fields
    const formattedBets = await Promise.all(bets.map(async (bet) => {
      // TypeScript needs type assertion to recognize the included relations
      const typedBet = bet as any;
      
      // Create game name from home and away team names
      const gameName = `${typedBet.game.homeTeam.name} vs. ${typedBet.game.awayTeam.name}`;
      
      // Find the matching odd for this bet
      const matchingOdd = await prisma.odd.findFirst({
        where: {
          gameId: typedBet.gameId,
          bookmakerId: typedBet.bookmakerId,
          marketId: typedBet.marketId,
          type: typedBet.oddType
        }
      });
      
      // Determine outcome and remaining amount if game has a result
      let result = null;
      let remainingAmount = null;
      
      if (typedBet.game.result) {
        // Check if the bet outcome matches the game result
        result = typedBet.oddType === typedBet.game.result.outcome ? 'won' : 'lost';
        
        // Calculate remaining amount using the odd's price if available
        if (result === 'lost') {
          remainingAmount = 0;
        } else if (matchingOdd) {
          // If we have the matching odd, use its price for calculation
          remainingAmount = typedBet.amount * matchingOdd.price;
        } else {
          // Fallback if no matching odd is found
          remainingAmount = typedBet.amount * 2;
        }
        }
      
      return {
        gameName,
        predictedOutcome: typedBet.oddType,
        amount: typedBet.amount,
        result,
        remainingAmount,
        gameDateTime: typedBet.game.commenceTime,
        bookmaker: typedBet.bookmaker.title,
        market: typedBet.market.key
      };
    }));
    
    res.json({
      service: 'users',
      userName,
      bets: formattedBets
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

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Users service received SIGTERM signal, shutting down gracefully');
  // Close server connections, etc.
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Users service received SIGINT signal, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`Users service is running on port ${PORT}`);
});
