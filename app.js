const express = require('express');
const { google } = require('googleapis');
const gmail = google.gmail('v1');
const OAuth2 = google.auth.OAuth2;
const dotenv = require('dotenv');
dotenv.config();

const app = express();


const oauth2Client = new OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  [process.env.REDIRECT_URIS]
);

app.get('/', (req, res) => {
  res.send("Hello!!");
});

// Redirect to Google OAuth2 consent screen
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify'],
    // prompt: 'consent',
  });
  res.redirect(authUrl);
});

// Callback route after user grants access
app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  const tokens = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens.tokens);
  res.send('Authentication successful. You can close this window now.');

  // Check for unread emails after setting credentials
  checkUnreadEmails();
});

// Function to check unread emails
async function checkUnreadEmails() {
  
  // Build the search query to filter emails from the specified sender
  const searchQuery = `is:unread from:${process.env.SENDER}`;
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: searchQuery,
    auth: oauth2Client,
  });

  const messages = response.data.messages;

  if (messages) {
    messages.forEach(async (message) => {
      const email = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        auth: oauth2Client,
      });

      // Handle the unread email (email data is available in the 'email' variable)
      console.log(email.data);
    });
  } else {
    console.log('No unread emails from the specified sender.');
  }
}

// Check token expiration and refresh if necessary
setInterval(async () => {
  if (oauth2Client.credentials.expiry_date <= Date.now()) {
    try {
      const refreshedTokens = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(refreshedTokens.credentials);
    } catch (error) {
      console.error('Error refreshing access token:', error.message);
    }
  }
}, 3600000); // Check every hour (3600000 milliseconds)

// Start the server
app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
