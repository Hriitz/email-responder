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
  process.env.REDIRECT_URIS,
);

app.get('/', (req,res) => {
    res.send("Hello!!")
})


const startApp = async () => {
    try {

            
        
    } catch (error) {
        console.error('Error Occurred:', error)
    }
}



// Start the server
app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT} `);
});
