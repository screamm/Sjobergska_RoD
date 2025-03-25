import { supabase } from './supabase';
import { google } from '../mocks/googleapis';

// Konfiguration för Google OAuth
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events'];
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.VITE_GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.VITE_GOOGLE_REDIRECT_URI || 'http://localhost:5173/auth/google/callback';

// Skapa OAuth2-klient
const oauth2Client = new google.auth.OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

// Skapa Google Calendar API-klient
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

export const googleCalendarApi = {
  // Generera URL för OAuth-autentisering
  getAuthUrl: () => {
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });
  },

  // Hantera OAuth-callback
  handleCallback: async (code: string) => {
    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);
      return tokens;
    } catch (error) {
      console.error('Fel vid hantering av OAuth-callback:', error);
      throw error;
    }
  },

  // Hämta händelser från Google Kalender
  getEvents: async (timeMin: string, timeMax: string) => {
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Fel vid hämtning av händelser:', error);
      throw error;
    }
  },

  // Skapa en ny händelse i Google Kalender
  createEvent: async (event: {
    summary: string;
    description?: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
  }) => {
    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      return response.data;
    } catch (error) {
      console.error('Fel vid skapande av händelse:', error);
      throw error;
    }
  },

  // Ta bort en händelse från Google Kalender
  deleteEvent: async (eventId: string) => {
    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });
    } catch (error) {
      console.error('Fel vid borttagning av händelse:', error);
      throw error;
    }
  },

  // Hämta synkroniseringsstatus
  getSyncStatus: async () => {
    try {
      const { data, error } = await supabase
        .from('sync_status')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.log('Kunde inte hämta sync_status:', error.message);
        // Om tabellen inte finns eller annat fel, returnera ett standardsvar
        return {
          status: 'not_configured',
          last_sync: new Date().toISOString(),
          error_message: 'Google Calendar-synkronisering är inte konfigurerad'
        };
      }

      return data;
    } catch (error) {
      console.error('Fel vid hämtning av synkroniseringsstatus:', error);
      return {
        status: 'error',
        last_sync: new Date().toISOString(),
        error_message: 'Kunde inte hämta synkroniseringsstatus'
      };
    }
  }
}; 