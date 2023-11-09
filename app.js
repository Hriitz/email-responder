const express = require('express');
const { google } = require('googleapis');
const gmail = google.gmail('v1');
const OAuth2 = google.auth.OAuth2;
require('dotenv').config();
const { Buffer } = require('buffer')

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


const repliedThreads = new Set();

async function createLabel() {
  try {
    await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: 'TEST',
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });
  } catch (error) {
    console.error('Error creating label:', error.message);
  }
}

createLabel();


// Function to check unread emails
async function checkUnreadEmails() {

  // Build the search query to filter emails from the specified sender
  const searchQuery = `is:unread`;

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: searchQuery,
    auth: oauth2Client,
  });

  const messages = response.data.messages;

  if (messages) {
    messages.forEach( async (message) => {
      const email = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        auth: oauth2Client,
      });

      // Handle the unread email (email data is available in the 'email' variable)
      console.log(email.data);

      const threadId = email.data.threadId;

      // Check if the thread has not been replied to
      if (!repliedThreads.has(threadId)) {
        // Reply to the email
        const senderEmail = email.data.payload.headers.find(
          (header) => header.name === 'From'
        ).value;
        const replyMessage = `Thank you for your email. This is an automated response.`;
        const encodedMessage = Buffer.from(`To: ${senderEmail}\r\n` +
          'Content-Type: text/plain;charset=utf-8\r\n' +
          'MIME-Version: 1.0\r\n' +
          'Subject: Re: ' + email.data.subject + '\r\n\r\n' +
          replyMessage).toString('base64');

        await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encodedMessage,
            threadId: threadId, // Use the same thread ID for the reply
          },
          auth: oauth2Client,
        });

        // Add the thread ID to the repliedThreads set to avoid replying again
        repliedThreads.add(threadId);

        console.log('Replied to the email thread and marked as read.');
      } else {
        console.log('Already replied to this email thread.');
      }
      
      await gmail.users.messages.modify({
        userId: 'me',
        id: message.id,
        requestBody: {
          addLabelIds: ['TEST'],
        },
      });

      console.log('Email tagged with the label.');

    });
  } else {
    console.log('No unread emails.');
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
