import axios from 'axios';
import config from '../config';

/**
 * Service for fetching NFL data from the Odds API
 */
export class NflDataService {
  /**
   * Fetches NFL game data from the Odds API
   * @returns Promise containing the games data
   */
  async fetchNflGames() {
    const url = `${config.oddsApiUrl}/v4/sports/${config.oddsSport}/odds/?apiKey=${config.oddsApiKey}&regions=${config.oddsRegions}&sport=${config.oddsSport}`;

    console.log(`Fetching data from: ${url.replace(config.oddsApiKey, '***API_KEY***')}`);
    
    try {
      const response = await axios.get(url);
      console.log(`Fetched ${response.data.length} games`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching NFL data:', error);
      if (error.response) {
        console.error('API response error:', error.response.data);
      }
      throw error;
    }
  }
}

// Export a singleton instance for convenience
export const nflDataService = new NflDataService();

// Export default for cases where dependency injection is preferred
export default NflDataService;
