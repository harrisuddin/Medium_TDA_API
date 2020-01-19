// Dependencies
var http = require('http');
var request = require('request');
var express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

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
        }

    });

});

app.get('/reset', (req, res) => {
    autoLogin();
    res.sendFile(path.join(__dirname, 'example.png'));
});

async function autoLogin() {

    // var details;
    // await fs.readFile('details.json', (err, data) => {
    //     if (err) console.error(err);
    //     details = JSON.parse(data);
    //     console.log(details);
    // });

    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto(`https://auth.tdameritrade.com/auth?response_type=code&redirect_uri=${encodeURI(redirect_uri)}&client_id=${process.env.CLIENT_ID}%40AMER.OAUTHAP`);

    // Enter username
    await page.click('#username');
    await page.keyboard.type("TrueAlpha");

    // Enter password
    await page.click('#password');
    await page.keyboard.type("dailyvolx16");

    // Click login button
    await page.click('#accept');

    // Click allow button
    await page.click('#accept');

    await page.screenshot({path: 'example.png'});

    // var updatedTimes = {
    //     access_last_update: Date().toString(),
    //     refresh_last_update: Date().toString()
    // };

    // await fs.writeFile('details.json', JSON.stringify(updatedTimes, null, 2), (err) => {
    //     if (err) console.error(err);
    // }); 

    // await fs.readFile('details.json', (err, data) => {
    //     if (err) console.error(err);
    //     details = JSON.parse(data);
    //     console.log(details);
    // });

    // Test page is correct with screenshot
    //await page.screenshot({path: 'example.png'});

    // Close browser
    await browser.close();

}

// start server
var httpServer = http.createServer(app);
var port = process.env.PORT || 8080;
httpServer.listen(port, () => {
    console.log(`Listening at ${port}`);
});