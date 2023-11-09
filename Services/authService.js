const { google } = require('googleapis');
const axios = reqiure('axios');

const tokenPath = './token.json'

const authenticate = async () => {
    const credentials = require('../client_secret_660377699298-lndjq5drrs0tlqtbv186bpl5oke3nj98.apps.googleusercontent.com.json');
    const {client_id, client_secret, redirect_uris} = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    try {
        const token = require(`../${tokenPath}`)
        oAuth2Client.setCredentials(token);
        return oAuth2Client;
    } catch (error) {
        throw new Error('Failed to load token')
    }
}