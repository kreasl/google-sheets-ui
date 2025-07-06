import { PrismaClient } from '@prisma/client';
import GoogleSheetsService from './googleSheetsService';
import config from '../config';

interface BetSheetRow {
  user: string;
  game_time: string;
  game_name: string;
  bookmaker: string;
  market: string;
  outcome: string;
  bet: string;
}

export class UiService {
  private readonly BETS_SHEET_NAME = 'Bets';
  private readonly GAMES_SHEET_NAME = 'Games';
  private readonly RESULTS_SHEET_NAME = 'Results';
  private prisma: PrismaClient;
  private sheetsService: GoogleSheetsService;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: { url: config.databaseUrl },
      },
    });
    this.sheetsService = new GoogleSheetsService();
  }

  async syncGamesToGoogleSheets(): Promise<number> {
    console.log('Syncing games data to Google Sheets...');
    
    try {
      const games = await this.prisma.game.findMany({
        include: {
          homeTeam: true,
          awayTeam: true,
          odds: {
            include: {
              bookmaker: true,
              market: true
            }
          }
        }
      });
      
      console.log(`Found ${games.length} games in the database`);
      
      const formattedData = [];
      
      for (const game of games) {
        for (const odd of game.odds) {
          formattedData.push({
            datetime: game.commenceTime.toISOString(),
            game_name: `${game.homeTeam.name} vs. ${game.awayTeam.name}`,
            bookmaker: odd.bookmaker.title,
            market: odd.market.key,
            outcome: odd.type,
            price: odd.price.toString()
          });
        }
      }
      
      console.log(`Formatted ${formattedData.length} rows of data for Google Sheets`);
      
      await this.sheetsService.updateSheet(this.GAMES_SHEET_NAME, formattedData);
      
      console.log('Successfully wrote game data to Google Sheets');
      
      return formattedData.length;
    } catch (error) {
      console.error('Error syncing games data to Google Sheets:', error);
      throw error;
    }
  }

  async syncBetsFromGoogleSheets(): Promise<{ total: number; valid: number; invalid: number; added: number }> {
    try {
      console.log('Reading bets from Google Sheets...');
      
      const betsData = await this.sheetsService.getSheetData<BetSheetRow>(this.BETS_SHEET_NAME);
      console.log(`Found ${betsData.length} bet entries in Google Sheets`);
      
      const sheetBetsMap = new Map<string, boolean>();
      
      let validCount = 0;
      let invalidCount = 0;
      
      for (const betRow of betsData) {
        try {
          if (!this.isValidBetRow(betRow)) {
            console.log(`Invalid bet row: ${JSON.stringify(betRow)}`);
            invalidCount++;
            continue;
          }
          
          const game = await this.findGame(betRow.game_name, new Date(betRow.game_time));
          if (!game) {
            console.log(`Game not found for: ${betRow.game_name} at ${betRow.game_time}`);
            invalidCount++;
            continue;
          }
          
          const bookmaker = await this.prisma.bookmaker.findFirst({
            where: {
              title: betRow.bookmaker
            }
          });
          
          if (!bookmaker) {
            console.log(`Bookmaker not found: ${betRow.bookmaker}`);
            invalidCount++;
            continue;
          }
          
          const market = await this.prisma.market.findFirst({
            where: {
              key: betRow.market
            }
          });
          
          if (!market) {
            console.log(`Market not found: ${betRow.market}`);
            invalidCount++;
            continue;
          }
          
          const odd = await this.prisma.odd.findFirst({
            where: {
              gameId: game.id,
              bookmakerId: bookmaker.id,
              marketId: market.id,
              type: betRow.outcome
            }
          });
          
          if (!odd) {
            console.log(`Odd not found for game: ${game.id}, bookmaker: ${bookmaker.id}, market: ${market.id}, outcome: ${betRow.outcome}`);
            invalidCount++;
            continue;
          }
          
          let user = await this.prisma.user.findFirst({
            where: {
              name: betRow.user
            }
          });
          
          if (!user) {
            user = await this.prisma.user.create({
              data: {
                name: betRow.user,
              }
            });
            console.log(`Created new user: ${user.name}`);
          }
          
          const betAmount = parseFloat(betRow.bet);
          if (isNaN(betAmount) || betAmount <= 0) {
            console.log(`Invalid bet amount: ${betRow.bet}`);
            invalidCount++;
            continue;
          }
          
          const betKey = `${user.id}_${game.id}_${odd.type}`;
          
          sheetBetsMap.set(betKey, true);
          
          const existingBet = await this.prisma.bet.findFirst({
            where: {
              userId: user.id,
              gameId: game.id,
              oddType: odd.type
            } as any
          });
          
          if (existingBet) {
            // Use type assertion to avoid lint errors until Prisma types are updated
            await this.prisma.bet.update({
              where: { id: existingBet.id },
              data: { 
                amount: betAmount,
                bookmakerId: bookmaker.id,
                marketId: market.id
              } as any
            });
            
            validCount++;
            console.log(`Updated existing bet for user ${user.name} on game ${game.id} with amount ${betAmount}`);
          } else {
            const betData: any = {
              amount: betAmount,
              oddType: odd.type,
              userId: user.id,
              gameId: game.id,
              bookmakerId: bookmaker.id,
              marketId: market.id
            };
            
            await this.prisma.bet.create({
              data: betData
            });
            
            validCount++;
            console.log(`Created new bet for user ${user.name} on game ${game.id} with amount ${betAmount}`);
          }
          
        } catch (error) {
          console.error(`Error processing bet row:`, error);
          invalidCount++;
        }
      }
      
      console.log('Checking for bets in database that are not in the sheet...');
      
      // Use type assertion to avoid lint errors until Prisma types are updated
      const allDbBets = await this.prisma.bet.findMany({
        include: {
          user: true,
          game: {
            include: {
              homeTeam: true,
              awayTeam: true
            }
          },
          bookmaker: true,
          market: true
        } as any
      });
      
      // Collect bets that need to be added to the sheet
      const betsToAddToSheet = [];
      
      for (const dbBet of allDbBets) {
        const bet = dbBet as any;
        const dbBetKey = `${bet.userId}_${bet.gameId}_${bet.oddType}`;
        
        if (!sheetBetsMap.has(dbBetKey)) {
          // Instead of removing from DB, prepare to add to sheet
          console.log(`Found bet ID ${bet.id} for user ${bet.user.name} on game ${bet.gameId} that's not in the sheet - will add to sheet`);
          
          // Format the bet for the sheet using bookmaker and market directly from the bet entity
          betsToAddToSheet.push({
            user: bet.user.name,
            game_time: bet.game.commenceTime.toISOString(),
            game_name: `${bet.game.homeTeam.name} vs. ${bet.game.awayTeam.name}`,
            bookmaker: bet.bookmaker.title,
            market: bet.market.key,
            outcome: bet.oddType,
            bet: bet.amount.toString()
          });
        }
      }
      
      // Add the missing bets to the sheet if there are any
      if (betsToAddToSheet.length > 0) {
        console.log(`Adding ${betsToAddToSheet.length} bets from database to Google Sheet`);
        
        // Get existing sheet data to append to
        const existingBetsData = await this.sheetsService.getSheetData<BetSheetRow>(this.BETS_SHEET_NAME);
        
        // Combine existing data with new bets
        const updatedBetsData = [...existingBetsData, ...betsToAddToSheet];
        
        // Update the sheet with the combined data
        await this.sheetsService.updateSheet(this.BETS_SHEET_NAME, updatedBetsData);
        
        console.log(`Successfully added ${betsToAddToSheet.length} bets to the sheet`);
      } else {
        console.log('No bets found in database that need to be added to the sheet');
      }
      
      return {
        total: betsData.length,
        valid: validCount,
        invalid: invalidCount,
        added: betsToAddToSheet.length,
      };
      
    } catch (error) {
      console.error('Error syncing bets from Google Sheets:', error);
      throw error;
    }
  }
  
  private isValidBetRow(betRow: BetSheetRow): boolean {
    return !!betRow.user && 
           !!betRow.game_time && 
           !!betRow.game_name && 
           !!betRow.bookmaker && 
           !!betRow.market && 
           !!betRow.outcome && 
           !!betRow.bet;
  }
  
  private async findGame(gameName: string, gameTime: Date): Promise<any> {
  // Parse game name in format "HomeTeam vs. AwayTeam"
  const parts = gameName.split(' vs. ');
  if (parts.length !== 2) {
    console.log(`Invalid game name format: ${gameName}`);
    return null;
  }
  
  const homeTeamName = parts[0];
  const awayTeamName = parts[1];
    const startTime = new Date(gameTime);
    startTime.setHours(startTime.getHours() - 12);
    
    const endTime = new Date(gameTime);
    endTime.setHours(endTime.getHours() + 12);
    
    return await this.prisma.game.findFirst({
      where: {
        homeTeam: {
          name: homeTeamName
        },
        awayTeam: {
          name: awayTeamName
        },
        commenceTime: {
          gte: startTime,
          lte: endTime
        }
      },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });
  }

  async syncUserResultsToGoogleSheets(): Promise<number> {
    try {
      console.log('Calculating user betting results...');
      
      const users = await this.prisma.user.findMany({
        include: {
          bets: {
            include: {
              game: {
                include: {
                  result: true,
                  odds: true
                }
              }
            }
          }
        }
      });
      
      console.log(`Found ${users.length} users with bets`);
      
      const userResults = users.map(user => {
        const betsPlaced = user.bets.length;
        
        const moneyPlaced = user.bets.reduce((total, bet) => total + (bet as any).amount, 0);
        
        let wins = 0;
        let losses = 0;
        let remainingAmount = 0;
        
        for (const bet of user.bets) {
          if (!bet.game.result) continue;
          
          const betWithType = bet as any;
          const betWon = betWithType.oddType === bet.game.result.outcome;
          
          if (betWon) {
            wins++;
            // For winning bets, we need to find the corresponding odd price from the game's odds
            // Since Bet doesn't have a direct odd relation, we need to find the odd with matching type
            const matchingOdd = (bet.game as any).odds?.find((odd: any) => odd.type === betWithType.oddType);
            
            if (matchingOdd) {
              // Add original stake + winnings (stake × (odds - 1))
              remainingAmount += betWithType.amount + betWithType.amount * (matchingOdd.price - 1);
            } else {
              // If no matching odd is found, just add the original stake
              remainingAmount += betWithType.amount;
              console.warn(`No matching odd found for bet ${bet.id} with type ${betWithType.oddType}`);
            }
          } else {
            losses++;
          }
        }
        
        // Calculate payout ratio with 4 decimal places and ensure no division by zero
        const payoutRatio = moneyPlaced > 0 ? Number((remainingAmount / moneyPlaced).toFixed(4)) : 0;
        
        return {
          user: user.name,
          bets_placed: betsPlaced,
          money_placed: moneyPlaced,
          wins: wins,
          losses: losses,
          remaining_amount: remainingAmount,
          payout_ratio: payoutRatio
        };
      });
      
      await this.sheetsService.updateSheet(this.RESULTS_SHEET_NAME, userResults);
      
      console.log(`Successfully wrote ${userResults.length} user results to the Results sheet`);
      return userResults.length;
      
    } catch (error) {
      console.error('Error syncing user results to Google Sheets:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export default UiService;
