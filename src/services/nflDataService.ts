import config from '../config';

export class NflDataService {
  async fetchNflGames() {
    const url = `${config.oddsApiUrl}/v4/sports/${config.oddsSport}/odds/?apiKey=${config.oddsApiKey}&regions=${config.oddsRegions}&sport=${config.oddsSport}`;

    console.log(`Fetching data from: ${url.replace(config.oddsApiKey, '***API_KEY***')}`);
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('API response error:', errorData);
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json() as any[];
      console.log(`Fetched ${data.length} games`);
      return data;
    } catch (error: any) {
      console.error('Error fetching NFL data:', error);
      throw error;
    }
  }
} 

export const nflDataService = new NflDataService();

export default NflDataService;
