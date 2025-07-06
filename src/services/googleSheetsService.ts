import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import config from '../config';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export class GoogleSheetsService {
  async getSheetData<T>(sheetName: string): Promise<T[]> {
    console.log(`Fetching data from spreadsheet ID: ${config.spreadsheetId}, sheet: ${sheetName}`);
    
    const rows = await this.readFromSheet(sheetName);
    
    if (!rows || rows.length === 0) {
      console.log('No data found in the spreadsheet.');
      return [];
    }
    
    console.log(`Retrieved ${rows.length} rows of data`);
    
    // Transform headers by replacing spaces with underscores
    const headers = rows[0].map((header: string) => header.replace(' ', '_'));
    
    const result = rows.slice(1).map(row => {
      const obj: any = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] !== undefined ? row[index] : '';
      });
      return obj;
    });
    
    return result as T[];
  }
  
  async updateSheet<T extends object>(sheetName: string, data: T[]): Promise<void> {
    if (!data || data.length === 0) {
      console.log('No data to write to sheet.');
      return;
    }
    
    const allFields = Object.keys(data[0]) as (keyof T)[];

    const values = this.convertToSheetValues<T>(data, allFields);

    // Transform headers by replacing underscores with spaces for better readability in the sheet
    const formattedHeaders = allFields.map(field => String(field).replace(/_/g, ' '));
    
    const allValuesWithHeader = [formattedHeaders, ...values];
    
    const updatedCells = await this.writeToSheet(sheetName, allValuesWithHeader);
    console.log(`${updatedCells} cells updated in Google Sheet`);
  }

  private async readFromSheet(sheetName: string): Promise<string[][]> {
    try {
      console.log('Making API request to Google Sheets...');
      const sheets = await this.getGoogleSheetsClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId as string,
        range: sheetName,
      });
      
      return response.data.values || [];
    } catch (error: any) {
      console.error('Error fetching spreadsheet data:', error);
      
      if (error.response && error.response.data) {
        console.error('API Error Details:', JSON.stringify(error.response.data, null, 2));
      }
      
      this.handleGoogleSheetsError(error);
      throw error;
    }
  }
  
  private async writeToSheet(sheetName: string, values: string[][]): Promise<number> {
    try {
      const sheets = await this.getGoogleSheetsClient();
      
      await sheets.spreadsheets.values.clear({
        spreadsheetId: config.spreadsheetId,
        range: sheetName,
      });
      
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId: config.spreadsheetId,
        range: sheetName,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: values
        },
      });
      
      return response.data.updatedCells || 0;
    } catch (error: any) {
      console.error('Error updating Google Sheet:', error);
      
      if (error.response && error.response.data) {
        console.error('API Error Details:', JSON.stringify(error.response.data, null, 2));
      }
      
      this.handleGoogleSheetsError(error);
      throw error;
    }
  }

  private async getGoogleSheetsClient() {
    try {
      if (!config.spreadsheetId) {
        throw new Error('spreadsheetId is not set in config. Please set it in your .env file.');
      }
      
      if (!config.credentials) {
        throw new Error('Google credentials are not available. Please check your credentials file.');
      }

      const auth = new GoogleAuth({
        credentials: config.credentials,
        scopes: SCOPES,
      });
      
      return google.sheets({ version: 'v4', auth });
    } catch (error) {
      console.error('Error initializing Google Sheets client:', error);
      throw error;
    }
  }

  private convertToSheetValues<T extends object>(data: T[], headers: (keyof T)[]): string[][] {
    if (!data || data.length === 0) return [];
      
    const values: string[][] = [];
    
    data.forEach(row => {
      const rowValues = headers.map(header => {
        const value = row[header];
        return value !== undefined && value !== null ? value.toString() : '';
      });
      values.push(rowValues);
    });
    
    return values;
  }

  private handleGoogleSheetsError(error: any): void {
    if (error.message && error.message.includes('credentials')) {
      console.error('\nCredentials Error: Please check that your credentials file exists and has the correct format.');
    } else if (error.code === 403 || (error.message && error.message.includes('permission'))) {
      console.error('\nPermission Error: The service account does not have sufficient permissions.');
      console.error('Please make sure you have:');
      console.error('1. Enabled the Google Sheets API in your Google Cloud Console');
      console.error('2. Shared the spreadsheet with the service account email with Editor access');
      console.error(`   Service account email: ${config.credentials?.client_email || 'Unknown'}`);
    } else if (error.message && error.message.includes('not found')) {
      console.error('\nSpreadsheet Not Found Error: The spreadsheet ID might be incorrect or the sheet name might be wrong.');
      console.error(`Current spreadsheet ID: ${config.spreadsheetId}`);
      console.error('\nVerify that:');
      console.error('1. The spreadsheet ID in your .env file is correct');
      console.error('2. The sheet name matches exactly (case-sensitive)');
    }
  }
}

export default GoogleSheetsService;
