import { PrismaClient } from '@prisma/client';
import config from '../config';
import { nflDataService } from './nflDataService';

export class GamesService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: { url: config.databaseUrl },
      },
    });
  }

  async fetchNflData(): Promise<{ processedGames: number }> {
    try {
      const games = await nflDataService.fetchNflGames();
      
      let processedGames = 0;
      
      for (const game of games) {
        const homeTeam = await this.getOrCreateTeam(game.home_team);
        const awayTeam = await this.getOrCreateTeam(game.away_team);
        
        const upsertedGame = await this.prisma.game.upsert({
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
          const upsertedBookmaker = await this.prisma.bookmaker.upsert({
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
            const upsertedMarket = await this.prisma.market.upsert({
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
              
              await this.prisma.odd.create({
                data: oddData,
              });
            }
          }
        }
        
        processedGames++;
        console.log(`Processed game: ${game.home_team} vs ${game.away_team}`);
      }
      
      console.log('Data import completed successfully');
      return { processedGames };
    } catch (error: any) {
      console.error('Error fetching or storing NFL data:', error);
      if (error.response) {
        console.error('API response error:', error.response.data);
      }
      throw error;
    }
  }

  async generateResults(): Promise<{ processedGames: number }> {
    try {
      const games = await this.prisma.game.findMany({
        include: {
          homeTeam: true,
          awayTeam: true,
          result: true
        }
      });

      if (games.length === 0) {
        return { processedGames: 0 };
      }

      console.log(`Found ${games.length} games`);
      let processedGames = 0;

      for (const game of games) {
        const homeScore = this.getRandomInt(0, 50);
        const awayScore = this.getRandomInt(0, 50);
        const outcome = this.determineOutcome(homeScore, awayScore);

        if (game.result) {
          // Update existing result
          await this.prisma.gameResult.update({
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
          await this.prisma.gameResult.create({
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
      return { processedGames };
    } catch (error) {
      console.error('Error generating game results:', error);
      throw error;
    }
  }

  private getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private determineOutcome(homeScore: number, awayScore: number) {
    if (homeScore > awayScore) return 'home_win';
    if (awayScore > homeScore) return 'away_win';
    return 'draw';
  }

  private async getOrCreateTeam(teamName: string) {
    const existingTeam = await this.prisma.team.findUnique({
      where: { name: teamName },
    });
    
    if (existingTeam) {
      return existingTeam;
    }
    
    return await this.prisma.team.create({
      data: {
        name: teamName,
      },
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export default GamesService;
