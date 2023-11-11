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

app.get('/auth', (req, res) => {
  // Generate Google OAuth2 consent screen URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify'],
  });
  res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
  // Handle the callback after the user grants access
  const code = req.query.code;
  const tokens = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens.tokens);
  res.send('Authentication successful. You can close this window now.');

  
  performSequence();
});

// Set to keep track of replied threads and sent emails in a thread
const repliedThreads = new Set();
const sentEmailsInThread = new Set();
const replyLabel = 'CustomLabel';

// Generate a random interval between min and max values
const getRandomInterval = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;


const performSequence = async () => {
  
  await checkUnreadEmails();
  
  const nextInterval = getRandomInterval(5000, 10000); 
  console.log(`Next execution in ${nextInterval / 1000} seconds.`);
  setTimeout(performSequence, nextInterval);
}

// Creating Label
const ensureLabelExists = async (labelName) => {
  const labelsResponse = await gmail.users.labels.list({
    userId: 'me',
    auth: oauth2Client,
  });

  const labels = labelsResponse.data.labels;
  const label = labels.find((label) => label.name === labelName);

  if (!label) {
    const createdLabel = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: labelName,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
      auth: oauth2Client,
    });

    console.log(`Label '${labelName}' created with ID: ${createdLabel.data.id}`);
    return createdLabel.data.id;
  }

  return label.id;
}

// Function to check unread emails
const checkUnreadEmails = async () => {
  const searchQuery = `is:unread`;
  const labelId = await ensureLabelExists(replyLabel);
  console.log(`Label ID: ${labelId}`);

  // List unread emails
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: searchQuery,
    auth: oauth2Client,
  });

  const messages = response.data.messages;

  if (messages) {
    messages.forEach(async (message) => {
      // Get the full email details
      const email = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        auth: oauth2Client,
      });
      
      const threadId = email.data.threadId;
      const messageId = email.data.id;

      // Check if the thread has not been replied to
      if (!repliedThreads.has(messageId)) {
        const sentMessagesInThread = await gmail.users.messages.list({
          userId: 'me',
          q: `from:me in:sent thread:${threadId}`,
          auth: oauth2Client,
        });

        if (!sentMessagesInThread.data.messages || sentMessagesInThread.data.messages.length === 0) {
          // Reply to the email
          const senderEmail = email.data.payload.headers.find(
            (header) => header.name === 'From'
          ).value;
          const replyMessage = `I'm on vacation`;
          const encodedMessage = Buffer.from(`To: ${senderEmail}\r\n` +
            'Content-Type: text/plain;charset=utf-8\r\n' +
            'MIME-Version: 1.0\r\n' +
            'Subject: Re: ' + email.data.subject + '\r\n\r\n' +
            replyMessage).toString('base64');

          await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
              raw: encodedMessage,
              threadId: threadId, 
            },
            auth: oauth2Client,
          });

          // Mark email as read and add the custom label
          await gmail.users.messages.modify({
            userId: 'me',
            id: message.id,
            requestBody: {
              removeLabelIds: ['UNREAD'],
              addLabelIds: [labelId],
            },
            auth: oauth2Client,
          });
          
          repliedThreads.add(threadId);
          sentEmailsInThread.add(messageId);

          console.log('Replied to the email thread and marked as read.');

        } else {
          console.log('Already replied to this email thread.');
        }
      }
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
}, 3600000); 

// Start the server
app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
