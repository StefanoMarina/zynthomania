/*********************************************************************
 * Zynthomania Server
 * Copyright (C) 2021 Stefano Marina
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
***********************************************************************/

const BodyParser = require('body-parser');
//const Osc = require('osc');
const EXPRESS = require('express');
const Fs = require('fs');
const Util = require ('util');
const OSCParser = require ('./parser.js')
//const EventEmitter = require('events');
const ZynthoMania = require ('./zyntho.js');

const app = EXPRESS();

app.zyntho = new ZynthoMania.ZynthoServer('preferences.json');

//express html server (7000)
app.use(EXPRESS.static(__dirname + '/node_modules'));  
app.use(EXPRESS.static(__dirname + '/assets'));

app.use (BodyParser.json());
app.use (BodyParser.urlencoded({extended:false}));


/************************
 * REST CALLBACKS
 ************************/

app.get('/', function(req, res,next) {  
    res.sendFile(__dirname + '/index.html');
});

 
/**
 * getBanks
 * GET request to retrieve all bank folder
 */
app.get('/getBanks', function (req, res, next) {
  console.log(`[GET] getBanks query: ${JSON.stringify(req.query)}`);
  res.json (app.zyntho.getBanks());
});

/**
 * getInstruments
 * GET request to retrieve all .xiz file inside a folder
 */
app.get('/getInstruments', function (req, res, next) {
  console.log(`[GET] getInstruments query: ${JSON.stringify(req.query)}`);
  
  if (req.query.bank === undefined) {
    res.status(400).end();
  }
  
  res.json(app.zyntho.getInstruments(req.query.bank));
});


/**
 * loadInstrument
 * POST loads xiz
 * BODY {instrument: instrument}
 */
app.post('/loadInstrument', function (req, res) {
  console.log(`[POST] /loadInstrument body: ${JSON.stringify(req.body)}`);
  
  if (req.body.id === undefined || req.body.instrument === undefined) {
    res.status(400).end();
  }
  
  app.zyntho.once('/damage', (msg) => {
        let score =RegExp("part(\\d+)","gm").exec(msg.args[0].value);
        if (score != null && score[1] == req.body.id) {
          console.log('done');
          res.status(200).end();
        }
  });
    
  app.zyntho.send(`/load_xiz ${req.body.id} "${req.body.instrument.path}"`);
});

  
/**
 * setFavorite
 * POST set/unset favorite
 * Body {action :"set/unset", instrument : {Instrument} }
 */
app.post('/setFavorite', function (req, res) {
  console.log(`[POST] /setFavorite body: ${JSON.stringify(req.body)}`);
  
  result = ('set' == req.body.action)
    ? app.zyntho.addFavorite(req.body.instrument)
    : app.zyntho.removeFavorite(req.body.instrument);
    
  res.status ( (!result) ? 400 :200).end();
});

/**
 * script
 * POST parse script
 * Body { script : "" }
 */
app.post('/script', function(req, res) {
  console.log(`[POST] /script body: ${JSON.stringify(req.body)}`);
  
  if (req.body.script === undefined) {
    res.status(400).send("Missing script");
    return;
  }
  
  app.zyntho.send(req.body.script);
  res.end();
});

/**
 * /status/partfx
 * GET creates an object to be filled with info on part efx.
 * this is an asynch function, it will wait for all effect to return
 * before sending.
 * id: part id
 */
 
app.get('/status/partfx', function (req, res, next) {
 console.log(`[GET] getStatusFX query: ${JSON.stringify(req.query)}`);
 
 if (req.query.id === undefined) {
   res.status(400).json({});
   return;
 }

 app.zyntho.queryPartFX(req.query.id, (result) => { res.json(result) });
})

/**
 * GET returns all zynthomania static options
 * query: none
 * return : json
 */
app.get('/status/options', function (req, res, next) {
  console.log(`[GET] getoptions query: ${JSON.stringify(req.query)}`);
  res.json(zyntho.preferences);
});

/**
 * /fx/part/next_fx
 * POST
 * changes a part efx
 * body {part: part id, efx: efx id}
 */
app.post('/fx/part/next_fx', function (req, res) {
  console.log(`[POST] nextFX query: ${JSON.stringify(req.body)}`);
  
  let partID = req.body.partID;
  let efxID = req.body.efxID;
  
  app.zyntho.query(app.zyntho.parser.translate(`/part${partID}/partefx${efxID}/efftype`),
  (msg) => {
    let value = msg.args[0].value;
    app.zyntho.changeFX(partID, efxID, ++value, (result) =>{
     // console.log(`result: ${result}`);
      res.json(result);
    });
  });
})

/**
 * /status/part
 * GET returns part info
 * query {id: part id}
 * return: json
 */

app.get('/status/part', function( req, res, next) {
  console.log(`[GET] getStatusPart query: ${JSON.stringify(req.query)}`);
  if ( req.query.id === undefined) {
    res.status(400).end();
    return;
  }

  app.zyntho.query(`/part${req.query.id}/Pname`, (result) => {
    res.json({name: result.args[0].value})
  });
});

app.on('open', () => {
  console.log ("Opened web application");
});

app.on('data', (data) =>{
  console.log('data: ' + JSON.stringify(data));
});

app.zyntho.open();

const server = require('http').createServer(app);
server.listen(7000);
