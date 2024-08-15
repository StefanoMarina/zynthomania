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
const Path = require('path');

const ZynthoIO = require ('./io.js');
const zconsole = ZynthoIO.zconsole;
const ZynthoMania = require ('./zyntho.js');
const OSCWorker = require ('./oscworker.js').OSCWorker;
const {execSync, exec, spawn} = require("child_process");

const Filter = require('./knot/knot.js').Filter;

const app = EXPRESS();

app.scripts_dir = Path.resolve(__dirname, '../install');

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

app.get('/', (req, res, next) => {  
  const chunkdir = __dirname + '/chunks/';
  chunkFiles = Fs.readdirSync(chunkdir);
  
  res.writeHead(200, {
    'Transfer-Encoding' : 'chunked'
  });
  
  res.write(Fs.readFileSync(__dirname + '/header.html'));
  chunkFiles.forEach ( (file) => { res.write(Fs.readFileSync(
      chunkdir + file ) ); } );
  res.write(Fs.readFileSync(__dirname + '/footer.html'));
  res.end();
    //res.sendFile(__dirname + '/index.html');
});

var util = require ('util')

/**
 * getChuck
 * return html content
 */
function get_chunk(req, res, next) {  
  zconsole.logGet(req);
  res.sendFile(__dirname + '/chunks/'+req.query.chunk+".html");
}
app.get('/chunk', get_chunk);

/**
 * getBanks
 * GET request to retrieve all bank folder
 */
function get_files_banks (req, res, next) {
  zconsole.logGet(req);
  
  res.json (app.zyntho.getBanks());
}
app.get('/files/banks', get_files_banks);

/**
 * getInstruments
 * GET request to retrieve all .xiz file inside a folder
 */
function get_files_banks_xiz (req, res, next) {
  zconsole.logGet(req);
  
  if (req.query.bank === undefined) {
    res.status(400).end();
  }
  
  res.json(app.zyntho.getInstruments(req.query.bank));
}
app.get('/files/banks/xiz', get_files_banks_xiz);

function get_files_scripts (req, res, next) {
  zconsole.logGet(req);
  let dir = app.zyntho.IO.workingDir + "/scripts";
  let files = [];
  if (Fs.existsSync(dir)){
    files = Fs.readdirSync (dir);
  }
  res.json(files);
}
app.get('/files/scripts', get_files_scripts);

/**
 * loadInstrument
 * POST loads xiz
 * BODY {instrument: instrument}
 */
function post_loadInstrument (req, res) {
  zconsole.logPost(req);
  
  if (req.body.id === undefined || req.body.instrument === undefined) {
    res.status(400).end();
  }
  
  app.zyntho.loadInstrument(req.body.id, req.body.instrument, function() {
    res.status(200).end();
  })
}
app.post('/loadInstrument', post_loadInstrument);

  
/**
 * setFavorite
 * POST set/unset favorite
 * Body {action :"set/unset", instrument : {Instrument} }
 */
function post_setFavorite (req, res) {
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
}
app.post('/setFavorite', post_setFavorite);

const SubsynthHarmonics = require('./subsynth').SubsynthHarmonics;

function post_subsynth(req, res) {
  zconsole.logPost(req);

  let ssgen = new  SubsynthHarmonics(req.body);
  
  let values = ssgen.perform(req.body.path);
  let bundle = app.zyntho.parser.translateLines(values);
  
  const worker = new OSCWorker(app.zyntho);
  worker.pushPacket(bundle, ()=>{});
  
  app.zyntho.sendOSC(bundle);
  worker.listen()
    .catch ( ()=> {
      res.status(400).send('bad request');
    })
    .finally( ()=>{
      res.end();
    });
}
app.post('/subsynth', post_subsynth);

/**
 * script
 * POST parse script
 * Body { script : "", requestResult: 1 }
 * @note if requestResult is present, but no OSC is
 * returned, the worker will hang on a undefined state.
 */
function post_script(req, res) {
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
    
    zconsole.debug(`script: worker has ${worker.stack.length} events`);
    
    app.zyntho.sendOSC(bundle);
    worker.listen(5000).then(()=>{
      res.json(result);
    }).catch( ()=> {
      res.statusMessage='No OSC Response';
      res.status(402).end();
    });
  } else {
    zconsole.log(JSON.stringify(bundle));
    app.zyntho.sendOSC(bundle);
    res.end();
  }
}
app.post('/script', post_script);

/**
 * /status/partfx
 * GET creates an object to be filled with info on part efx.
 * this is an asynch function, it will wait for all effect to return
 * before sending.
 * id: part id
 */
 
function get_status_partfx (req, res, next) {
  zconsole.logGet(req);

  if (req.query.id === undefined || req.query.id.match(/\d+/)==null) {
   res.status(400).end();
   return;
  }

  const resultObject = {'efx' : [], 'sysefx' : []};
  
  Promise.all( [
    app.zyntho.queryPartFX(req.query.id) ,
    app.zyntho.queryPackFXNames('/sysefx[0-3]',4)
  ]).then( (values)=>{
    values[0].sysefxnames = values[1];
    res.json(values[0]);
  });
}
app.get('/status/partfx', get_status_partfx);

function get_status_fx(req, res, next) {
  zconsole.logGet(req);
  
  if (req.query.path === undefined) {
    req.status(400).end();
    return;
  }
  
  app.zyntho.getFX(req.query.path).then ( (result) => {
 
    res.json(result);
  });
}
app.get('/status/fx', get_status_fx);

/**
 * /status/partfx
 * GET creates an object to be filled with info on part efx.
 * this is an asynch function, it will wait for all effect to return
 * before sending.
 * id: part id
 */
 
function get_status_systemfx (req, res, next) {
 zconsole.logGet(req);
 app.zyntho.querySystemFX((result) => { res.json(result) }, req.query.part);
}
app.get('/status/systemfx', get_status_systemfx);

/**
 * GET returns all zynthomania options
 * query: none
 * return : json
 */
function get_status_options (req, res, next) {
  zconsole.logGet(req);
  res.json(app.zyntho.config);
}
app.get('/status/options', get_status_options);

/**
 * GET returns MIDI information status
 * query: none
 * return: json
 */
 
/**
 * /status/part
 * GET returns part info
 * query {id: part id}
 * return: json
 */

function get_status_part( req, res, next) {
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
}
app.get('/status/part',get_status_part);

/**
 * /status/binds
 * GET return array with bind information
 */
function get_status_binds( req, res, next) {
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
}
app.get('/status/binds', get_status_binds);

function get_binds_session (rq, res) {
  zconsole.logGet(rq);
  
  if (app.zyntho.midiService.sessionConfig == null) {
    res.json({});
  } else
    res.json(app.zyntho.midiService.sessionConfig);
}
app.get('/binds/session', get_binds_session);

/**
 * /midilearn
 * GET request a midi learn event
 * Will wait for an event for 3 seconds, then sends error
 */
function get_midilearn(rq, res) {
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
  
}
app.get('/midilearn', get_midilearn);

/**
 * /status/subsynth
 * returns info on subsynth generator
 * query: magnitude or bandwidth, no query equals all
 */
 function get_status_subsynth(rq, res) {
   zconsole.logGet(rq);
   
   if (rq.query.element === undefined)
    res.json(app.zyntho.ssHarmonics.data);
   else
    res.json(app.zyntho.ssHarmonics.data[rq.query.element]);
 }
 app.get('/status/subsynth', get_status_subsynth);
 
/**
 * /status/session
 * GET returns XMZ session info and extended session data
 */
function get_status_session (rq, res) {
  zconsole.logGet(rq);
  
  let result = {};
  result.sessionList = ZynthoIO.listAllFiles(app.zyntho.IO.workingDir+"/"+"sessions")
    .filter ( (e) => e.match(/\.xmz$/i)) ;
  result.currentSession = app.zyntho.lastSession;
  result.sessionData = app.zyntho.session;
  res.json(result);
}
app.get('/status_session', get_status_session);

function get_status_split (req, res) {
  app.zyntho.getSplit( (result) => {
    res.json(result);
  });
}
app.get('/status/split', get_status_split);

/**
 * /system
 * GET grabs system info
 */
function get_system (rq, res) {
  zconsole.logGet(rq);  
  let result = {};
  
  result.cpuTemp = execSync('cat /sys/class/thermal/thermal_zone0/temp').toString();
  if (result.cpuTemp != null && result.cpuTemp.match(/\d+/)) {
    result.cpuTemp = parseInt(result.cpuTemp)/1000 + " °";
  } else
  result.cpuTemp = "N/A";
  
  try { result.zynProcess = execSync('pgrep zynaddsubfx').toString()}
    catch (e) {result.zynProcess = "NA"}
  try {result.jackProcess = execSync('pgrep jackd').toString()}
    catch (e) {result.jackProcess = "NA"}
  try { result.netAddress = execSync ('hostname -I').toString().trim().split(" ")}
    catch (e) {result.netAddress = []};
  
  result.workingDir = app.zyntho.IO.workingDir;
  try {
    let value = execSync('systemctl is-active dhcpcd').toString();
    result.isHotspot = (replace(/\n|\r/g,value)  == 'inactive');
  } catch (e) {
    result.isHotspot = undefined
  };
  
  res.json(result);
}
app.get('/system', get_system);

function get_system_midi (req, res, next) {
  zconsole.logGet(req);
  res.json(app.zyntho.midiService.enumerateInputs());
}
app.get('/system/midi', get_system_midi);

/**
 * POST
 */
/**
* /fx/set
* [POST] set an FX effect type. returns a call to get_fx
* body { [part: partid], fx : fx channel id, type: type id, [preset: preset id] }
* will publish the new fx preset, if available
*/
function post_fx_set (req, res) {
  zconsole.logPost(req);
  
  if (req.body.efftype == null || req.body.path == null) {
    res.status(400).end();
    return;
  }
  let OSCPacket= app.zyntho.translate(`${req.body.path}/efftype ${req.body.efftype}`);
  
  if (req.body.efftype == 0) {
    app.zyntho.osc.send(OSCPacket);
    app.json({'efftype': 0});
    return;
  }
  
  let worker = new OSCWorker(app.zyntho);
  worker.pushPacket(OSCPacket);
  
  app.zyntho.osc.send(OSCPacket);
  worker.listen().then ( ()=>{
    return app.zyntho.getFX(req.query.path);
  }).then ( (result) => {
      res.json(result);
  });
}
app.post('/fx/type', post_fx_set);

/**
 * /fx/preset
 * Changes a preset
 * will publish new fx data
 */
function post_fx_preset(req, res) {
  zconsole.logPost(req);
  
  if (req.body.preset == null || req.body.path == null) {
    res.status(400).end();
    return;
  }
  
  let OSCPacket= app.zyntho.parser.translate(`${req.body.path}/preset ${req.body.preset}`);
  let worker = new OSCWorker(app.zyntho);
  worker.pushPacket(OSCPacket);
  
  app.zyntho.osc.send(OSCPacket);
  worker.listen().then ( ()=>{
    return app.zyntho.getFX(req.query.path);
  }).then ( (result) => {
      res.json(result);
  });
}
app.post('/fx/preset', post_fx_preset);

/**
 * /fx/route
 * POST sets the new route filter
 * body: { route: route object }
 */

function post_fx_route(req, res) {
  if (req.body.route === undefined){
    res.status(400).end();
    return;
  }
  
  app.zyntho.config.route = req.body.route;
  app.zyntho.save();
  
  app.zyntho.route(undefined, undefined, () =>{
    res.status(200).end();
  });
}
app.post('/fx/route', post_fx_route);

/**
 * /fx/dry
 * POST sets new dry filter
 * @body : {dry: array of names}
 */
function post_fx_dry(req, res) {
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
}
app.post('/fx/dry', post_fx_dry);

/**
 * POST /system/midi/plug
 * connect or disconnect midi device
 * @body : {plug: device id, status: desired action, true for connect}
 */
function post_system_midi_plug(req, res) {
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
  
}
app.post('/system/midi/plug', post_system_midi_plug);

/**
 * POST /binds/add
 * add a new file to the bind chain.
 * @body : {file}
 */
function post_binds_add(req, res) {
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
}
app.post('/binds/add', post_binds_add);


/**
 * POST /binds/add
 * add a new file to the bind chain.
 * @body : {file}
 */
function post_binds_remove(req, res) {
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
}
app.post('/binds/remove', post_binds_remove);

function post_binds_session (req, res) {
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
}
app.post('/binds/session', post_binds_session);

/**
 * POST /binds/session/set
 * add a new file to the bind chain.
 * @body : {file}
 */
 
function post_binds_session_set (req, res) {
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
}
app.post('/binds/session/set', post_binds_session_set);

/**
 * POST /binds/session/save
 * add a new file to the bind chain.
 * @body : {file}
 */
 
function post_binds_session_save (req, res) {
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
}
app.post('/binds/session/save', post_binds_session_save);

/**
 * POST network/change
 * change network status
 * @body : { toHotspot : true|false }
 */
 function post_network_change (req, res ) {
   if (req.body.toHotspot === undefined ) {
     res.status(400).end();
     return;
   }
   if (app.zyntho.IO.readOnlyMode){
    res.statusMessage='System is read only.';
    res.status(403).end();
    return;
  }
  
  let logFile = `${app.workingDir}/network-change.log`;
  
  // try to change to hotspot
  if (req.body.toHotspot === 1) {
    try{
       execSync(`${app.scripts_dir}/set-hotspot.sh`);
    } catch (err) {
      res.statusMessage='Error in hotspot set';
      res.status(500).end();
      return;
    }
  } else {
    try{
       execSync(`${app.scripts_dir}/restore-wifi.sh`);
    } catch (err) {
      res.statusMessage='Error in wifi restore';
      res.status(500).end();
      return;
    }
  }
  
  return app.shutdownZyn( {body : { reboot : true } }, res);
 }
 app.post('/network-change', post_network_change);
 
/**
 * 
 * POST /reconnect
 * restarts connection with zynaddsubfx
*/
function post_reconnect (req, res) {
  zconsole.logPost(req);
  
  try {
    execSync('pgrep zynaddsubfx');
  } catch (err) {
    zconsole.notice('ZynAddSubFX not running, trying to manually run...');
    try {
      let sysjackdir = Path.resolve(__dirname, '../sysjack');
      outcome = execSync(`${sysjackdir}/install.pl config=${app.zyntho.IO.workingDir}/config.json key=services -y -s zynaddsubfx`)
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
}
app.post('/reconnect', post_reconnect);

/**
* Updates any extended session parameter
*/
function post_session_set (req, res) {
  zconsole.logPost(req);
  for (let key in app.zyntho.session) {
    if (req.body[key] !== undefined) {
      console.log(`changing ${key} to ${req.body[key]}`)
      app.zyntho.session[key] = req.body[key];
    }
  }
  res.end();
}
app.post('/session/set', post_session_set);

//Shutdown default behaviour
app.shutdownZyn =  function(req,res) {
  let reboot=(req.body.reboot !== undefined) ?
		req.body.reboot : true;
    
//Save session to default.xmz
app.zyntho.on('saved', function(filename) {
    if (!filename.endsWith('default.xmz'))
      return;
    
    if (reboot) {
     zconsole.notice('Rebooting system');
     exec ('reboot');
    } else {
     zconsole.notice('Shutdown system');
     exec ('shutdown 0');
    }  
  });
  
  app.zyntho.sessionSave();
  
  res.end();
}

app.post('/shutdown', app.shutdownZyn);

app.on('open', () => {
  zconsole.log ("Opened web application");
});

app.on('data', (data) =>{
  zconsole.notice('data: ' + JSON.stringify(data));
});

/*
 * MAIN
 */
 
var myArgv = process.argv.slice(2);
try {
  if (myArgv.length > 0) {
    app.workingDir = myArgv[0];
    app.zyntho.open(myArgv[0]);
  }
  else {
    throw 'You must specify a working directory';
  }
} catch (err) {
  zconsole.critical(err);
  return;
}

const server = require('http').createServer(app);

let port = app.zyntho.config.services.user.remote_port;
zconsole.log(`Opening html server on port ${port}`);
zconsole.log(`Scripts dir: ${app.scripts_dir}`);

server.listen(port);
