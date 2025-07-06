import { PrismaClient } from '@prisma/client';
import config from '../config';

export class UsersService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: { url: config.databaseUrl },
      },
    });
  }

  async createOrUpdateBet(
    userName: string, 
    gameName: string, 
    gameDateTime: string, 
    outcomeType: string, 
    amount: string, 
    bookmakerName: string, 
    marketCode: string
  ) {
    if (!userName || !gameName || !gameDateTime || !outcomeType || !amount || !bookmakerName || !marketCode) {
      throw new Error('Missing required fields');
    }
    
    let gameDateObj: Date;
    try {
      gameDateObj = new Date(gameDateTime);
      if (isNaN(gameDateObj.getTime())) {
        throw new Error('Invalid gameDateTime format. Please provide a valid ISO date string.');
      }
    } catch (error) {
      throw new Error('Invalid gameDateTime format. Please provide a valid ISO date string.');
    }

    if (!['home_win', 'away_win', 'draw'].includes(outcomeType)) {
      throw new Error('Invalid oddType value');
    }
    let user = await this.prisma.user.findFirst({
      where: { name: userName }
    });
    
    if (!user) {
      console.log(`Creating new user with name: ${userName}`);
      user = await this.prisma.user.create({
        data: {
          name: userName
        } as any
      });
      console.log(`Created new user:`, user);
    }

    const gameNameParts = gameName.split(' vs. ');
    if (gameNameParts.length !== 2) {
      throw new Error('Invalid game name format. Expected format: "Home Team vs. Away Team"');
    }
    
    const [homeTeamName, awayTeamName] = gameNameParts;
    
    const homeTeam = await this.prisma.team.findUnique({
      where: { name: homeTeamName }
    });
    
    const awayTeam = await this.prisma.team.findUnique({
      where: { name: awayTeamName }
    });
    
    if (!homeTeam || !awayTeam) {
      throw new Error(`Team not found: ${!homeTeam ? homeTeamName : awayTeamName}`);
    }
    
    const gameQuery: any = {
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id
    };
    
    const games = await this.prisma.game.findMany({
      where: gameQuery,
      orderBy: {
        commenceTime: 'asc'
      }
    });
    
    if (games.length === 0) {
      throw new Error(`Game '${gameName}' not found`);
    }
    
    const game = games.reduce((closest, current) => {
      const closestDiff = Math.abs(closest.commenceTime.getTime() - gameDateObj.getTime());
      const currentDiff = Math.abs(current.commenceTime.getTime() - gameDateObj.getTime());
      return currentDiff < closestDiff ? current : closest;
    }, games[0]);
    
    console.log(`Selected game with commenceTime ${game.commenceTime} based on provided gameDateTime ${gameDateObj}`);

    const bookmaker = await this.prisma.bookmaker.findFirst({
      where: { title: bookmakerName }
    });

    if (!bookmaker) {
      throw new Error(`Bookmaker with name '${bookmakerName}' not found`);
    }

    const market = await this.prisma.market.findUnique({
      where: { key: marketCode }
    });

    if (!market) {
      throw new Error(`Market with code '${marketCode}' not found`);
    }

    const existingBet = await this.prisma.bet.findFirst({
      where: {
        userId: user.id,
        gameId: game.id
      }
    });

    let bet;
    if (existingBet) {
      const updateData: any = {
        amount: parseFloat(amount),
        oddType: outcomeType,
        bookmakerId: bookmaker.id,
        marketId: market.id
      };
      
      bet = await this.prisma.bet.update({
        where: { id: existingBet.id },
        data: updateData
      });
    } else {
      const createData: any = {
        userId: user.id,
        gameId: game.id,
        oddType: outcomeType,
        amount: parseFloat(amount),
        bookmakerId: bookmaker.id,
        marketId: market.id
      };
      
      bet = await this.prisma.bet.create({
        data: createData
      });
    }

    return {
      isNew: !existingBet,
      bet
    };
  }

  async getUserResults(userName: string) {
    const user = await this.prisma.user.findFirst({
      where: { name: userName }
    });
    
    if (!user) {
      throw new Error(`User with name '${userName}' not found`);
    }
    
    const bets = await this.prisma.bet.findMany({
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
    
    const formattedBets = await Promise.all(bets.map(async (bet) => {
      const typedBet = bet as any;
      const gameName = `${typedBet.game.homeTeam.name} vs. ${typedBet.game.awayTeam.name}`;
      
      const matchingOdd = await this.prisma.odd.findFirst({
        where: {
          gameId: typedBet.gameId,
          bookmakerId: typedBet.bookmakerId,
          marketId: typedBet.marketId,
          type: typedBet.oddType
        }
      });
      
      let result = null;
      let remainingAmount = null;
      
      if (typedBet.game.result) {
        result = typedBet.oddType === typedBet.game.result.outcome ? 'won' : 'lost';
        
        if (result === 'lost') {
          remainingAmount = 0;
        } else if (matchingOdd) {
          remainingAmount = typedBet.amount * matchingOdd.price;
        } else {
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
    
    return {
      userName,
      bets: formattedBets
    };
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export default UsersService;
