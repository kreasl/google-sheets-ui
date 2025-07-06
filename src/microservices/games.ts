import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import config from '../config';
import { nflDataService } from '../services/nflDataService';

const app = express();
const PORT = process.env.PORT || 3000;

const prisma = new PrismaClient({
  datasources: {
    db: { url: config.databaseUrl },
  },
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.get('/', (req, res) => {
  res.json({ service: 'games', message: 'Games microservice is running' });
});

app.get('/fetch-nfl-data', async (req, res) => {
  try {
    const games = await nflDataService.fetchNflGames();
    
    let processedGames = 0;
    
    for (const game of games) {
      const homeTeam = await getOrCreateTeam(game.home_team);
      const awayTeam = await getOrCreateTeam(game.away_team);
      
      const upsertedGame = await prisma.game.upsert({
        where: { id: game.id },
        update: {
          sportKey: game.sport_key,
          sportTitle: game.sport_title,
          commenceTime: new Date(game.commence_time),
          homeTeam: { connect: { id: homeTeam.id } },
          awayTeam: { connect: { id: awayTeam.id } },
        },
        create: {
          id: game.id,
          sportKey: game.sport_key,
          sportTitle: game.sport_title,
          commenceTime: new Date(game.commence_time),
          homeTeam: { connect: { id: homeTeam.id } },
          awayTeam: { connect: { id: awayTeam.id } },
        },
      });
      
      for (const bookmaker of game.bookmakers) {
        const upsertedBookmaker = await prisma.bookmaker.upsert({
          where: { key_title: { key: bookmaker.key, title: bookmaker.title } },
          update: {
            lastUpdate: new Date(bookmaker.last_update),
          },
          create: {
            key: bookmaker.key,
            title: bookmaker.title,
            lastUpdate: new Date(bookmaker.last_update),
          },
        });
        
        for (const market of bookmaker.markets) {
          const upsertedMarket = await prisma.market.upsert({
            where: { key: market.key },
            update: {
              lastUpdate: new Date(market.last_update),
            },
            create: {
              key: market.key,
              lastUpdate: new Date(market.last_update),
            },
          });
          
          for (const odd of market.outcomes) {
            let oddData = {
              price: odd.price,
              type: 'unknown',
              gameId: game.id,
              bookmakerId: upsertedBookmaker.id,
              marketId: upsertedMarket.id,
            };
            
            if (odd.name === game.home_team) {
              oddData.type = 'home_win';
            } else if (odd.name === game.away_team) {
              oddData.type = 'away_win';
            } else if (odd.name === 'Draw' || odd.name.toLowerCase() === 'draw' || odd.name.toLowerCase() === 'tie') {
              oddData.type = 'draw';
            }
            
            if (oddData.type === 'unknown' && 
                (odd.name.toLowerCase().includes('draw') || 
                 odd.name.toLowerCase().includes('tie'))) {
              oddData.type = 'draw';
              console.log(`Detected draw from name pattern: ${odd.name}`);
            }
            
            await prisma.odd.create({
              data: oddData,
            });
          }
        }
      }
      
      processedGames++;
      console.log(`Processed game: ${game.home_team} vs ${game.away_team}`);
    }
    
    console.log('Data import completed successfully');
    res.json({ success: true, message: `Successfully processed ${processedGames} games` });
  } catch (error: any) {
    console.error('Error fetching or storing NFL data:', error);
    if (error.response) {
      console.error('API response error:', error.response.data);
    }
    res.status(500).json({ success: false, error: 'Failed to fetch and process NFL data' });
  }
});

app.get('/generate-results', async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      include: {
        homeTeam: true,
        awayTeam: true,
        result: true
      }
    });

    if (games.length === 0) {
      return res.json({ success: true, message: 'No games found' });
    }

    console.log(`Found ${games.length} games`);
    let processedGames = 0;

    for (const game of games) {
      const homeScore = getRandomInt(0, 50);
      const awayScore = getRandomInt(0, 50);
      const outcome = determineOutcome(homeScore, awayScore);

      if (game.result) {
        // Update existing result
        await prisma.gameResult.update({
          where: { id: game.result.id },
          data: {
            homeScore,
            awayScore,
            outcome
          }
        });
        processedGames++;
        console.log(`Updated result for game ${game.id}: ${game.homeTeam.name} ${homeScore} - ${awayScore} ${game.awayTeam.name} (${outcome})`);
      } else {
        // Create new result
        await prisma.gameResult.create({
          data: {
            homeScore,
            awayScore,
            outcome,
            game: {
              connect: { id: game.id }
            }
          }
        });
        processedGames++;
        console.log(`Generated new result for game ${game.id}: ${game.homeTeam.name} ${homeScore} - ${awayScore} ${game.awayTeam.name} (${outcome})`);
      }
    }

    console.log('All game results generated/updated successfully');
    res.json({ success: true, message: `Successfully generated/updated results for ${processedGames} games` });
  } catch (error) {
    console.error('Error generating game results:', error);
    res.status(500).json({ success: false, error: 'Failed to generate game results' });
  }
});

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function determineOutcome(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) return 'home_win';
  if (awayScore > homeScore) return 'away_win';
  return 'draw';
}

async function getOrCreateTeam(teamName: string) {
  const existingTeam = await prisma.team.findUnique({
    where: { name: teamName },
  });
  
  if (existingTeam) {
    return existingTeam;
  }
  
  return await prisma.team.create({
    data: {
      name: teamName,
    },
  });
}

process.on('SIGTERM', async () => {
  console.log('Games service received SIGTERM signal, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Games service received SIGINT signal, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Games service is running on port ${PORT}`);
});
