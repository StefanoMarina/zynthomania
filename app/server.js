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
const ZynthoIO = require ('./io.js');
const zconsole = ZynthoIO.zconsole;
const ZynthoMania = require ('./zyntho.js');
const OSCWorker = require ('./oscworker.js').OSCWorker;
const {execSync, exec, spawn} = require("child_process");

const Filter = require('./knot/knot.js').Filter;

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
  zconsole.logGet(req);
  
  res.json (app.zyntho.getBanks());
});

/**
 * getInstruments
 * GET request to retrieve all .xiz file inside a folder
 */
app.get('/files/banks/xiz', function (req, res, next) {
  zconsole.logGet(req);
  
  if (req.query.bank === undefined) {
    res.status(400).end();
  }
  
  res.json(app.zyntho.getInstruments(req.query.bank));
});

app.get('/files/scripts', function (req, res, next) {
  zconsole.logGet(req);
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
  zconsole.logPost(req);
  
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
  zconsole.logPost(req);
  
  if (req.body.instrument == null || Object.keys(req.body.instrument).length ==0) {
    res.statusMessage = 'Invalid instrument';
    res.status(400).end();
    return;
  }
  
  result = ('set' == req.body.action)
    ? app.zyntho.addFavorite(req.body.instrument)
    : app.zyntho.removeFavorite(req.body.instrument);
    
  res.status ( (!result) ? 400 :200).end();
});

/**
 * script
 * POST parse script
 * Body { script : "", requestResult: 1 }
 * @note if requestResult is present, but no OSC is
 * returned, the worker will hang on a undefined state.
 */
app.post('/script', function(req, res) {
  zconsole.logPost(req);
  
  if (req.body.script === undefined) {
    res.status(400).send("Missing script");
    return;
  }
  
  let bundle = null;
  try {
    bundle = (Array.isArray(req.body.script))
            ? app.zyntho.parser.translateLines(req.body.script)
            :app.zyntho.parser.translate(req.body.script);
    
  } catch (err) {
    res.statusMessage = 'Invalid syntax.';
    res.status(400).end();
    return;
  }
  
  if (req.body.requestResult) {
    const worker = new OSCWorker(app.zyntho);
    const result = {};
    
    worker.pushPacket(bundle, (add, args) => {
      let index = 0;
      let key = add;
      
      while (result[key] !== undefined) {
        key = `${add}_${++index}`;
      }
      
      result[key] = args.map( (e) => e.value);
    });
    
    app.zyntho.sendOSC(bundle);
    worker.listen(5000).then(()=>{
      res.json(result);
    }).catch( ()=> {
      res.statusMessage='No OSC Response';
      res.status(402).end();
    });
  } else {
    app.zyntho.sendOSC(bundle);
    res.end();
  }
});

/**
 * /status/partfx
 * GET creates an object to be filled with info on part efx.
 * this is an asynch function, it will wait for all effect to return
 * before sending.
 * id: part id
 */
 
app.get('/status/partfx', function (req, res, next) {
 zconsole.logGet(req);
 
 if (req.query.id === undefined || req.query.id.match(/\d+/)==null) {
   res.status(400).end();
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
 zconsole.logGet(req);
 app.zyntho.querySystemFX((result) => { res.json(result) }, req.query.part);
})


/**
 * GET returns all zynthomania options
 * query: none
 * return : json
 */
app.get('/status/options', function (req, res, next) {
  zconsole.logGet(req);
  res.json(app.zyntho.config);
});

/**
 * GET returns MIDI information status
 * query: none
 * return: json
 */
app.get('/status/midi', function (req, res, next) {
  zconsole.logGet(req);
  res.json(app.zyntho.midiService.enumerateInputs());
});


/**
 * /status/part
 * GET returns part info
 * query {id: part id}
 * return: json
 */

app.get('/status/part', function( req, res, next) {
  zconsole.logGet(req);
  if ( req.query.id === undefined) {
    res.status(400).end();
    return;
  }

  const result = {};
  let partInfo = [
    `/part${req.query.id}/Pname`,
    `/part${req.query.id}/Pvolume`,
    `/part${req.query.id}/Ppanning`,
    `/part${req.query.id}/Penabled`,
    `/part${req.query.id}/Prcvchn`
  ];
  
  const worker = new OSCWorker(app.zyntho);
  
  let bundle = app.zyntho.parser.translateLines(partInfo);
  worker.pushPacket( bundle , (add, args) => {
    let property = add.match(/\/P(\w+)$/)[1];
    result[property] = args[0].value;
  });
  
  app.zyntho.osc.send(bundle);
  
  worker.listen().then(()=>{
    let instrument = app.zyntho._getInstruments(req.query.id);
    if (instrument != null) {
      result.instrument = instrument;
    }
    res.json(result);
  });
});

/**
 * /status/binds
 * GET return array with bind information
 */
app.get('/status/binds', function( req, res, next) {
  zconsole.logGet(req);
  
  let result = {};
  
  let list = app.zyntho.midiService.filterList;
  result.chain = list.map( item => item.match(/[^/]+$/)[0]);
  result.hasInstrument = app.zyntho.midiService.instrumentMap != null;
  result.sessionConfig = app.zyntho.midiService.sessionConfig;
  
  try {
    result.files = ZynthoIO.listAllFiles(app.zyntho.IO.workingDir+"/"+"binds");
   // console.log(JSON.stringify(result, null, 2));
    res.json(result);
  } catch (err) {
    zconsole.error(`Error on file parsing: ${err}`);
    res.status(500).end();
  }
});

app.get('binds/session', function (rq, res) {
  zconsole.logGet(rq);
  
  if (app.zyntho.midiService.sessionConfig == null) {
    res.json({});
  } else
    res.json(app.zyntho.midiService.sessionConfig);
});

/**
 * /midilearn
 * GET request a midi learn event
 * Will wait for an event for 3 seconds, then sends error
 */
app.get('/midilearn', function(rq, res) {
  zconsole.logGet(rq);
  
  app.zyntho.midiService.once('learn', (msg) => {
    if (!res._headerSent)
      res.json(msg);
  });
  
  app.zyntho.midiService.midiLearn(rq.query.force);
  
  setInterval( ()=> {
    if (!res._headerSent) {
      res.statusMessage='Midi learn timeout';
      res.status(408).end();
    }
  }, 3000);
  
});

/**
 * /status/session
 * GET returns XMZ session info and extended session data
 */
app.get('/status/session', function (rq, res) {
  zconsole.logGet(rq);
  
  let result = {};
  result.sessionList = ZynthoIO.listAllFiles(app.zyntho.IO.workingDir+"/"+"sessions")
    .filter ( (e) => e.match(/\.xmz$/i)) ;
  result.currentSession = app.zyntho.lastSession;
  result.sessionData = app.zyntho.session;
  res.json(result);
});

/**
 * /status/session
 * GET grabs system info
 */
app.get('/status/system', function (rq, res) {
  zconsole.logGet(rq);  
  let result = {};
  
  result.cpuTemp = execSync('cat /sys/class/thermal/thermal_zone0/temp').toString();
  if (result.cpuTemp != null && result.cpuTemp.match(/\d+/)) {
    result.cpuTemp = parseInt(result.cpuTemp)/1000 + " °";
  } else
  result.cpuTemp = "N/A";
  
  try { result.zynProcess = execSync('pgrep zynaddsubfx').toString()}
  catch (e) {result.zynProcess = null}
  try {result.jackProcess = execSync('pgrep jackd').toString()}
  catch (e) {result.jackProcess = null}
  result.workingDir = app.zyntho.IO.workingDir;
  	
  res.json(result);
});

app.get('/status/split', function (req, res) {
  app.zyntho.getSplit( (result) => {
    res.json(result);
  });
});

/**
* /fx/set
* [POST] sets a part fx id and/or preset. if part id is null, system fx will be
* changed instead
* body { [part: partid], fx : fx channel id, type: type id, [preset: preset id] }
* will publish the new fx preset, if available
*/
app.post('/fx/set', function (req, res) {
  zconsole.logPost(req);
  if (req.body.fx == null) {
    res.status(400).end();
    return;
  }
  
  app.zyntho.changeFX(req.body.part, req.body.fx, req.body.type, req.body.preset,
                        (data) => {res.json(data)});
  
});
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
  zconsole.logPost(req);
  if (req.body.name === undefined || req.body.status === undefined){
    res.status(400).end();
    return;
  }
  
  
  try {
    app.zyntho.midiService.setConnection(req.body.name, req.body.status);
    res.status(200).end();
  } catch (err) {
    zconsole.error (`Error on plug operation: ${err}`);
    res.status(500).end();
  }
  
});

/**
 * POST /binds/add
 * add a new file to the bind chain.
 * @body : {file}
 */
app.post('/binds/add', function(req, res) {
  zconsole.logPost(req);
  if (req.body.file === undefined) {
    res.status(400).end();
    return;
  }
  
  try {
    let path = app.zyntho.IO.workingDir + "/binds/" + req.body.file;
    app.zyntho.midiService.addBind(path);
    res.status(200).end();
  } catch (err) {
    zconsole.error(err);
    res.status(500).end();
  }
});

/**
 * POST /binds/add
 * add a new file to the bind chain.
 * @body : {file}
 */
app.post('/binds/remove', function(req, res) {
  zconsole.logPost(req);
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
      zconsole.error(err);
      res.status(500).end();
    }
  } else {  
    try {
      let path = app.zyntho.IO.workingDir + "/binds/" + req.body.file;
      app.zyntho.midiService.removeBind(path);
      res.status(200).end();
    } catch (err) {
      zconsole.error(err);
      res.status(500).end();
    }
  }
});

app.post('/binds/session', function (req, res) {
  zconsole.logPost(req);
  if (req.body.file === undefined){
     res.status(400).end();
     return;
  }
  
  let file = app.zyntho.midiService.cartridgeDir + `/${req.body.file}`;
  if (!Fs.existsSync(file)) {
    res.statusMessage='Invalid file.';
    res.status(404).end();
    return;
  }
  
  try {
    let sessionData = JSON.parse(Fs.readFileSync(file));
    app.zyntho.midiService.sessionConfig = sessionData;
    app.zyntho.midiService.sessionMap = null;
    app.zyntho.midiService.refreshFilterMap(false);
    res.json(sessionData);
  } catch (err) {
    zconsole.error(err);
    res.statusMessage='Invalid session file';
    res.status(402).end();
  }
});

/**
 * POST /binds/session/set
 * add a new file to the bind chain.
 * @body : {file}
 */
 
app.post('/binds/session/set', function (req, res) {
  zconsole.logPost(req);
  
  if (req.body.session === undefined){
     res.status(400).end();
     return;
  }
  
  Object.keys(req.body.session).forEach( (ch) => {
    req.body.session[ch].forEach( (e) => {
      try {
        Filter.sanitize(e);
      } catch (err) {
        zconsole.notice(`Bad filter : ${err}`);
        res.statusMessage='Invalid session file';
      res.status(402).end();
      }
    })
  });
  
  app.zyntho.midiService.sessionConfig = req.body.session;
  app.zyntho.midiService.sessionMap = null;
  
  let oldConfig = app.zyntho.midiService.knot.filterMap;
  
  try {
    app.zyntho.midiService.refreshFilterMap(false);
    res.end();
  } catch (err) {
    zconsole.error(err);
    app.zyntho.midiService.sessionConfig = null;
    app.zyntho.midiService.sessionMap = null;
    app.zyntho.midiService.knot.filterMap = oldConfig;
    res.statusMessage='Invalid session file';
    res.status(402).end();
  }
});

/**
 * POST /binds/session/save
 * add a new file to the bind chain.
 * @body : {file}
 */
 
app.post('/binds/session/save', function (req, res) {
  zconsole.logPost(req);
  
  if (req.body.file === undefined){
     res.status(400).end();
     return;
  }
  if (app.zyntho.IO.readOnlyMode){
    res.statusMessage='System is read only.';
    res.status(403).end();
    return;
  }
  if (app.zyntho.midiService.sessionConfig == null) {
    res.statusMessage='Empty session binding';
    res.status(403).end();
    return;
  }
  
  let bindDir = app.zyntho.midiService.cartridgeDir+`/${req.body.file}`;
  
  try {
    Fs.writeFile(bindDir, JSON.stringify(app.zyntho.midiService.sessionConfig,null,2), 'utf-8', ()=>{
      res.end();
    });
  } catch (err) {
    zconsole.error(`Cannot save file: ${err}`);
    
    res.statusMessage='Cannot save!';
    res.status(500).end();
  }
});

/**
* POST restarts connection with zynaddsubfx
*/
app.post('/reconnect', (req, res) => {
  zconsole.logPost(req);
  
  try {
    execSync('pgrep zynaddsubfx');
  } catch (err) {
    zconsole.notice('ZynAddSubFX not running, trying to manually run...');
    try {
      outcome = execSync(`../sysjack/install.pl config=${app.zyntho.IO.workingDir}/config.json key=services -y -s zynaddsubfx`)
                        .toString();
                        
      //split args
      let match = outcome.match(/^(.*)\/zynaddsubfx (.*)/);
      
      zconsole.log(`Launching zynaddsubfx with line ${outcome}...`);
      let args = match[2].split(/ +/);
      spawn(`${match[1]}/zynaddsubfx`,args);
      
    } catch (err) {
      zconsole.error(err);
      res.statusMessage='Cannot launch Zyn!';
      res.status(503).end();
    }
  }
  
  
  app.zyntho.osc.once('close', ()=> {
    zconsole.log('Relaunching osc connection...');
    
    app.zyntho.once('ready', () =>{
      res.status(200).end();
    });
    
    app.zyntho.connectToZyn();
  });
  
  app.zyntho.osc.close();
});


/**
* Updates any extended session parameter
*/
app.post('/session/set', function (req, res) {
  zconsole.logPost(req);
  for (let key in app.zyntho.session) {
    if (req.body[key] !== undefined) {
      console.log(`changing ${key} to ${req.body[key]}`)
      app.zyntho.session[key] = req.body[key];
    }
  }
  res.end();
});

app.on('open', () => {
  zconsole.log ("Opened web application");
});

app.on('data', (data) =>{
  zconsole.notice('data: ' + JSON.stringify(data));
});

var myArgv = process.argv.slice(2);

try {
  if (myArgv.length > 0)
    app.zyntho.open(myArgv[0]);
  else {
    app.zyntho.open(`${OS.homedir()}/.zmania`);
  }
} catch (err) {
  zconsole.critical(err);
  return;
}

const server = require('http').createServer(app);
server.listen(7000);
