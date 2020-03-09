// Dependencies
var http = require('http');
var request = require('request');
var express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const detailsFileName = './details.json';
var details = require(detailsFileName);
const Days90 = 7776000; // 90 days in seconds
const Minutes30 = 1800 // 30 mins in seconds

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
            var authReply = JSON.parse(body);
            // to check it's correct, display it
            res.send(authReply);
        }
    });
});

app.get('/reset', (req, res) => {
    resetTokens().then(function (result) {
        res.send(result);
    }, function (err) {
        res.send(err);
    });
});

/*
Automatically fill in the login form to authenticate the TDA app

NB:
The refresh token expires in 90 days after creating
The access token expires in 30 minutes after creating

*/
async function resetTokens() {

    // Launch the browser
    const browser = await puppeteer.launch({
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();

    // Go to the authentication page
    await page.goto(`https://auth.tdameritrade.com/auth?response_type=code&redirect_uri=${encodeURI(redirect_uri)}&client_id=${process.env.CLIENT_ID}%40AMER.OAUTHAP`);

    // Enter username
    await page.click('#username');
    await page.keyboard.type(process.env.USERNAME);

    // Enter password
    await page.click('#password');
    await page.keyboard.type(process.env.PASSWORD);

    // Click login button
    await page.click('#accept');

    // Click allow button
    await page.click('#accept');

    // get the tokens from the pre element
    var elem = await page.$("pre");
    var text = await page.evaluate(elem => elem.textContent, elem);

    // parse the response to a new object
    var jsonText = JSON.parse(text);
    console.log(jsonText);

    // update the details file object
    details.access_token = jsonText.access_token;
    details.refresh_token = jsonText.refresh_token;
    let time = Date().toString();
    details.access_last_update = time;
    details.refresh_last_update = time;

    // write the updated object to the details.json file
    fs.writeFile(detailsFileName, JSON.stringify(details, null, 2), function (err) {
        if (err) console.error(err);
    });

    // Close browser
    await browser.close();

    // return the text
    return text;

}

/*
Reset the TDA access token
*/
function resetAccessToken() {
    var refresh_token_req = {
        url: 'https://api.tdameritrade.com/v1/oauth2/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        form: {
            'grant_type': 'refresh_token',
            'refresh_token': details.refresh_token,
            'client_id': process.env.CLIENT_ID
        }
    };

    request(refresh_token_req, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // get the TDA response
            var authReply = JSON.parse(body);
            details.access_token = authReply.access_token;
            details.access_last_update = Date().toString();

            // write the updated object to the details.json file
            fs.writeFileSync(detailsFileName, JSON.stringify(details, null, 2), function (err) {
                if (err) console.error(err);
            });
        }
    });
}

/*
returns true if the time difference is more than or equal to the maxDifference
maxDifference should be in seconds
*/
function compareTimeDifference(t1, t2, maxDifference) {
    var date1 = new Date(t1);
    var date2 = new Date(t2);

    var diff = Math.floor((date2 - date1) / 1000); // difference in seconds

    return (diff >= maxDifference);
}

/*
checks if the access/refresh are valid and if not then 
generate new tokens
*/
function validateTokens() {
    let time = Date().toString();
    // if the refresh token is expired, then reset both tokens
    if (compareTimeDifference(details.refresh_last_update, time, Days90)) {
        console.log("both updating");
        resetTokens();
    // if the access token is expired, then reset it
    } else if (compareTimeDifference(details.access_last_update, time, Minutes30)) {
        console.log("refresh updating");
        resetAccessToken();
    }                  
}

function getQuote(ticker) {
    validateTokens();
    var quoteReq = {
        url: `https://api.tdameritrade.com/v1/marketdata/${ticker}/quotes?apikey=${process.env.CLIENT_ID}`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${details.access_token}`
        }
    };

    request(quoteReq, function (error, response, body) {
        // If there's no errors
        if (!error && response.statusCode == 200) {
            // get the TDA response
            var reply = JSON.parse(body);
            // to check it's correct, display it
            console.log(reply);
            return reply;
        }
    });
}

app.get('/quote/:ticker', (req, res) => {
    console.log(req.params);
    let quote = getQuote(req.params.ticker);
    res.send(quote);
});

// start server
var httpServer = http.createServer(app);
var port = process.env.PORT || 8080;
httpServer.listen(port, () => {
    console.log(`Listening at ${port}`);
});