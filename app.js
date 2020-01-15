// Dependencies
var http = require('http');
var request = require('request');
var express = require('express');

var app = express();
const redirect_uri = 'https://td-api-medium.herokuapp.com/auth';

/* 
Callback endpoint the TDA app uses.
To understand more about how the API authenticates, see this link.
https://developer.tdameritrade.com/content/simple-auth-local-apps
*/
app.get('/auth', (req, res) => {

    var authRequest = {
        url: 'https://api.tdameritrade.com/v1/oauth2/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        form: {
            'grant_type': 'authorization_code',
            'access_type': 'offline',
            'code': req.query.code, // get the code from url
            'client_id': process.env.CLIENT_ID + "@AMER.OAUTHAP", // client id stored in heroku
            'redirect_uri': redirect_uri
        }
    };

    request(authRequest, function (error, response, body) {
        // If there's no errors
        if (!error && response.statusCode == 200) {
            // get the TDA response
            authReply = JSON.parse(body);
            // to check it's correct, display it
            res.send(authReply);
        } else {
            // if there are errors, display them with an error 400
            res.status(400).json({error: error});
        }

    });

});

// start server
var httpServer = http.createServer(app);
var port = process.env.PORT || 8080;
httpServer.listen(port, () => {
    console.log(`Listening at ${port}`);
});