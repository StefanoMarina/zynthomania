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
const EXPRESS = require('express');
const Fs = require('fs');
const OS = require('os'); 
const Util = require ('util');
const OSCParser = require ('./parser.js')
const ZynthoIO = require ('./io.js');
const ZynthoMania = require ('./zyntho.js');

const app = EXPRESS();

var args = process.argv.slice(2);
app.zyntho = new ZynthoMania.ZynthoServer(args[0]);

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
app.get('/files/banks', function (req, res, next) {
  console.log(`[GET] getBanks query: ${JSON.stringify(req.query)}`);
  res.json (app.zyntho.getBanks());
});

/**
 * getInstruments
 * GET request to retrieve all .xiz file inside a folder
 */
app.get('/files/banks/xiz', function (req, res, next) {
  console.log(`[GET] getInstruments query: ${JSON.stringify(req.query)}`);
  
  if (req.query.bank === undefined) {
    res.status(400).end();
  }
  
  res.json(app.zyntho.getInstruments(req.query.bank));
});

app.get('/files/scripts', function (req, res, next) {
  console.log(`[GET] /files/scripts query: ${JSON.stringify(req.query)}`);
  let dir = app.zyntho.IO.workingDir + "/scripts";
  let files = [];
  if (Fs.existsSync(dir)){
    files = Fs.readdirSync (dir);
  }
  res.json(files);
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
  
  app.zyntho.loadInstrument(req.body.id, req.body.instrument.path, function() {
    res.status(200).end();
  })
  
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
 * /status/partfx
 * GET creates an object to be filled with info on part efx.
 * this is an asynch function, it will wait for all effect to return
 * before sending.
 * id: part id
 */
 
app.get('/status/systemfx', function (req, res, next) {
 console.log(`[GET] systemfx query: ${JSON.stringify(req.query)}`);
 app.zyntho.querySystemFX((result) => { res.json(result) });
})


/**
 * GET returns all zynthomania options
 * query: none
 * return : json
 */
app.get('/status/options', function (req, res, next) {
  console.log(`[GET] getoptions query: ${JSON.stringify(req.query)}`);
  res.json(app.zyntho.config);
});

/**
 * GET returns MIDI information status
 * query: none
 * return: json
 */
app.get('/status/midi', function (req, res, next) {
  console.log(`[GET] getMIDI query: ${JSON.stringify(req.query)}`);
  res.json(app.zyntho.midiService.enumerateInputs());
});


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

/**
 * /status/binds
 * GET return array with bind information
 */
app.get('/status/binds', function( req, res, next) {
  console.log(`[GET] binds status query: ${JSON.stringify(req.query)}`);
  
  let result = {};
  
  let list = app.zyntho.midiService.filterList;
  result.chain = list.map( item => item.match(/[^/]+$/)[0]);
  result.hasInstrument = app.zyntho.midiService.instrumentMap != null;
  
  try {
    result.files = ZynthoIO.listAllFiles(app.zyntho.IO.workingDir+"/"+"binds");
   // console.log(JSON.stringify(result, null, 2));
    res.json(result);
  } catch (err) {
    console.log(`Error on file parsing: ${err}`);
    res.status(500).end();
  }
});

/**
 * /status/session
 * GET returns session info
 */
app.get('/status/session', function (rq, res) {
  console.log("[GET] /status/session/");
  let result = {};
  result.sessionList = ZynthoIO.listAllFiles(app.zyntho.IO.workingDir+"/"+"sessions");
  result.currentSession = app.zyntho.lastSession;
  res.json(result);
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
 * /fx/part/prev_fx
 * POST
 * changes a part efx
 * body {part: part id, efx: efx id}
 */
app.post('/fx/part/prev_fx', function (req, res) {
  console.log(`[POST] nextFX query: ${JSON.stringify(req.body)}`);
  
  let partID = req.body.partID;
  let efxID = req.body.efxID;
  
  app.zyntho.query(app.zyntho.parser.translate(`/part${partID}/partefx${efxID}/efftype`),
  (msg) => {
    let value = msg.args[0].value;
    app.zyntho.changeFX(partID, efxID, --value, (result) =>{
      res.json(result);
    });
  });
})

/**
 * /fx/system/next_fx
 * POST
 * changes a system efx
 * body { efx: efx id}
 */
app.post('/fx/system/next_fx', function (req, res) {
  console.log(`[POST] nextFX query: ${JSON.stringify(req.body)}`);
  
  let efxID = req.body.efxID;
  
  app.zyntho.query(app.zyntho.parser.translate(`/sysefx${efxID}/efftype`),
  (msg) => {
    let value = msg.args[0].value;
    app.zyntho.changeFX(undefined, efxID, ++value, (result) =>{
      res.json(result);
    });
  });
})

/**
 * /fx/system/prev_fx
 * POST
 * changes a system efx
 * body { efx: efx id}
 */
app.post('/fx/system/prev_fx', function (req, res) {
  console.log(`[POST] nextFX query: ${JSON.stringify(req.body)}`);
  
  let efxID = req.body.efxID;
  
  app.zyntho.query(app.zyntho.parser.translate(`/sysefx${efxID}/efftype`),
  (msg) => {
    let value = msg.args[0].value;
    app.zyntho.changeFX(undefined, efxID, --value, (result) =>{
      res.json(result);
    });
  });
})


/**
 * /fx/route
 * POST sets the new route filter
 * body: { route: route object }
 */

app.post('/fx/route', function(req, res) {
  if (req.body.route === undefined){
    res.status(400).end();
    return;
  }
  
  app.zyntho.config.route = req.body.route;
  app.zyntho.save();
  
  app.zyntho.route(undefined, undefined, () =>{
    res.status(200).end();
  });
});

/**
 * /fx/dry
 * POST sets new dry filter
 * @body : {dry: array of names}
 */
app.post('/fx/dry', function(req, res) {
  if (req.body.dry === undefined){
    res.status(400).end();
    return;
  }
  
  app.zyntho.config.dry = req.body.dry;
  app.zyntho.save();
  
  //force routing
  app.zyntho.route(undefined, undefined, (msg) =>{
    res.status(200).end();
  });
});

/**
 * POST /status/midi/plug
 * connect or disconnect midi device
 * @body : {plug: device id, status: desired action, true for connect}
 */
app.post('/status/midi/plug', function(req, res) {
  console.log(`[POST] plug request: ${JSON.stringify(req.body)}`);
  if (req.body.name === undefined || req.body.status === undefined){
    res.status(400).end();
    return;
  }
  
  
  try {
    app.zyntho.midiService.setConnection(req.body.name, req.body.status);
    res.status(200).end();
  } catch (err) {
    console.log (`Error on plug operation: ${err}`);
    res.status(500).end();
  }
  
});

/**
 * POST /binds/add
 * add a new file to the bind chain.
 * @body : {file}
 */
app.post('/binds/add', function(req, res) {
  console.log(`[POST] bind_add request: ${JSON.stringify(req.body)}`);
  if (req.body.file === undefined) {
    res.status(400).end();
    return;
  }
  
  try {
    let path = app.zyntho.IO.workingDir + "/binds/" + req.body.file;
    app.zyntho.midiService.addBind(path);
    res.status(200).end();
  } catch (err) {
    console.log(err);
    res.status(500).end();
  }
});

/**
 * POST /binds/add
 * add a new file to the bind chain.
 * @body : {file}
 */
app.post('/binds/remove', function(req, res) {
  console.log(`[POST] bind_remove request: ${JSON.stringify(req.body)}`);
  if (req.body.file === undefined) {
    res.status(400).end();
    return;
  }
  
  if (req.body.file == "instrument") {
    try {
      app.zyntho.midiService.instrumentMap = null;
      app.zyntho.midiService.refreshFilterMap(false);
      res.status(200).end();
    } catch (err) {
      console.log("<3> " +err);
      res.status(500).end();
    }
  } else {  
    try {
      let path = app.zyntho.IO.workingDir + "/binds/" + req.body.file;
      app.zyntho.midiService.removeBind(path);
      res.status(200).end();
    } catch (err) {
      console.log("<3> "+err);
      res.status(500).end();
    }
  }
});

app.on('open', () => {
  console.log ("Opened web application");
});

app.on('data', (data) =>{
  console.log('data: ' + JSON.stringify(data));
});

var myArgv = process.argv.slice(2);

try {
  if (myArgv.length > 0)
    app.zyntho.open(myArgv[0]);
  else {
    app.zyntho.open(`${OS.homedir()}/.zmania`);
  }
} catch (err) {
  console.error(`<1> ${err}`);
  return;
}

const server = require('http').createServer(app);
server.listen(7000);
