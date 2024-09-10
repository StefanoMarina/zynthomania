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

function get_favorites(req, res) {
  zconsole.logGet(req);
  res.json (app.zyntho.favorites);
}
app.get('/files/favorites', get_favorites);

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

function get_files(req, res, next) {
  zconsole.logGet(req);
  
  if (req.query.dir === undefined) {
    res.status(400).end();
    return;
  }
  
  if (req.query.dir.search(/[\/\.\:]+/) > -1) {
    res.statusMessage = `${req.query.dir} - bad chars`;
    res.status(403).end();
    return;
  }
  
  let dir = `${app.zyntho.IO.workingDir}/${req.query.dir}`;
  let files = [];
  if (Fs.existsSync(dir)){
    files = Fs.readdirSync (dir);
  } else {
    res.statusMessage=`Cannot find ${dir}`;
    res.status(404).end();
    return;
  }
  res.json(files);
}
app.get('/files', get_files);

function post_files_newbank(req,res) {
  zconsole.logPost(req);
  if (req.body.dir === undefined) {
    res.status(400).end();
    return;
  }
  
  let dir = `${app.zyntho.config.cartridge_dir}/banks/${req.body.dir}`;
  
  if (Fs.existsSync(dir)) {
    res.statusMessage = 'Directory already exists!';
    res.status(409).end();
    return;
  }
  
  try {
    Fs.mkdirSync(dir);
  } catch {
    res.status(500);
  } finally {
    res.end();
  }
}
app.post('/files/newbank', post_files_newbank);

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
    res.json(app.zyntho.session);
    res.status(200).end();
  })
}
app.post('/loadInstrument', post_loadInstrument);

/**
 * /midilearn
 * POST request a midi learn event
 * Will wait for an event for 3 seconds, then sends error
 */
function post_midilearn(rq, res, next) {
  zconsole.logPost(rq);
  
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
app.post('/midilearn', post_midilearn);
  
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
    app.zyntho.oscPromise('/sysefx[0-3]/efftype')
      .then ( (result) => {
        return Object.values(result)
          .map ( aVal => ZynthoMania.typeToString(aVal[0]));
      })
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
 * /status
 * Sends info for the main toolbar
 * @query {partID: part Id}
 */
 function get_status(req, res){
    zconsole.logGet(req);
    if ( req.query.partID === undefined) {
      res.status(400).end();
      return;
    } 
    
    let part = `/part${req.query.partID}`;
    app.zyntho.oscPromise ([
      `${part}/Pname`,
      `/tempo`,
      `/volume`,
      `${part}/Penabled`
    ]). then ( (result) => {
      let instrument = app.zyntho.getInstrumentNameFromFile(req.query.partID);
      if (instrument != null) {
        result.instrument = instrument;
      } else 
        result.instrument = {};
      
      result.session = app.zyntho.config.lastSession;
      
      res.json(result);
      res.end();
    }).catch( (err)=>{
      res.statusMessage = err;
      res.status(500).end();
    });
 }
  
 app.get('/status', get_status);
 
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
    let instrument = app.zyntho.getInstrumentNameFromFile(req.query.id);
    if (instrument != null) {
      result.instrument = instrument;
    }
    res.json(result);
  });
}
app.get('/status/part',get_status_part);

/**
 * /status/binds/chain
 * GET return array with bind information
 * @params id may be session, or controlles, or instrument. if not specified,
 *  an array is returned the size of each map
 */
 
function get_status_binds( req, res, next) {
  zconsole.logGet(req);
  let midi = app.zyntho.midiService;
  
  var result = {};
  
  if ( req.query.id == undefined ) {
    Object.entries (midi.chainController.chain).forEach ( ([id, obj]) => { 
        result[id] = { 'enabled' : obj.enabled };
    });
    
    Object.entries (midi.chainSession.chain).forEach ( ([id, obj]) => { 
        result[id] = { 'enabled' : obj.enabled };
    });
    
  } else if ('session' == req.query.id) {
    result = midi.getSessionBindings();
  } else {
    result = (midi.chainController.getBindings(req.query.id) !== undefined)
      ? midi.chainController.getBindings(req.query.id)
      : midi.chainSession.getBindings(req.query.id)
  }
  
  if (result == null) {
    res.status(400).end();
  } else
  res.json(result);
}

app.get('/status/binds', get_status_binds);

/**
 * /status/session
 * GET returns XMZ session info and extended session data
 */
function get_status_session (rq, res) {
  zconsole.logGet(rq);
  res.json ( app.zyntho.session);
}
app.get('/status/session', get_status_session);

function get_system_info(req, res) {
  zconsole.logGet(req);  
  let result = {};
  
  //temperature
  result.cpuTemp = execSync('cat /sys/class/thermal/thermal_zone0/temp').toString();
  if (result.cpuTemp != null && result.cpuTemp.match(/\d+/)) {
    result.cpuTemp = parseInt(result.cpuTemp)/1000 + " °";
  } else
  result.cpuTemp = "N/A";
  
  //working dir
  result.workingDir = app.zyntho.IO.workingDir;
  
  //ram
  try {
    let ramRex = /(\d+(,\d+)?[GMK])/g;
    let processOutput = execSync('free -mh').toString();
    
    let totalMem = ramRex.exec(processOutput)[1],
      usedMem = ramRex.exec(processOutput)[1];
    result.memory = `${usedMem} / ${totalMem}`;  
  } catch (err) {
    result.memory = 'NA';
  }
  
  res.json(result);
  res.end();
}
app.get('/system/info', get_system_info);

function get_system_modules(req,res) {
  zconsole.logGet(req);  
  let result = {};
  try { result.zynProcess = execSync('pgrep zynaddsubfx').toString()}
    catch (e) {result.zynProcess = "NA"}
  try {result.jackProcess = execSync('pgrep jackd').toString()}
    catch (e) {result.jackProcess = "NA"}
  
  res.json(result);
  res.end();
}
app.get('/system/modules', get_system_modules);


function get_system_network(req,res) {
  zconsole.logGet(req);  
  let result = {};
  
  //dhcpcd mode
  try {
    let value = execSync('systemctl is-active dhcpcd').toString();
    result.isHotspot = (replace(/\n|\r/g,value)  == 'inactive');
  } catch (e) {
    result.isHotspot = undefined
  };
  
  res.json(result);
  res.end();
}
app.get('/system/network', get_system_network);

function get_controllers (req, res, next) {
  zconsole.logGet(req);
  res.json(app.zyntho.midiService.enumerateInputs());
}
app.get('/controllers', get_controllers);


function get_presets(req, res) {
  zconsole.logGet(req);
  if (req.query.bank === undefined) {
    res.status(400).end();
    return;
  }
  if (req.query.bank.search(/[\/\.\:]+/) > -1) {
    res.statusMessage = `${req.query.bank} - bad chars`;
    res.status(403).end();
    return;
  }
  
  let dir = `${app.zyntho.IO.workingDir}/presets/${req.query.bank}`;
  
  let files = ZynthoIO.listAllFiles(dir, true, 'name');
  if ( files.length == 0 ){
    res.statusMessage=`cannot find ${dir}`;
    res.status(404).end();
    return;
  }
  console.log(JSON.stringify(files));
  
  res.json ( files.map ( file => (file !== undefined) 
      ? file.replaceAll('_', ' ').replace('.osc','')
      : 'error')
  );
  res.end();
}
app.get('/presets', get_presets);

/**
 * POST
 */

function post_apply_preset(req,res) {
  zconsole.logPost(req);
  if (req.body.bank === undefined || req.body.name === undefined) {
    res.status(400).end();
    return;
  }
  if (req.body.bank.search(/[\/\.\:]+/) > -1) {
    res.statusMessage = `${req.body.bank} - bad chars`;
    res.status(403).end();
    return;
  }
  let keychain = (req.body.keychain === undefined) ? null
    : req.body.keychain;
  
  app.zyntho.loadPreset(req.body.bank, keychain, req.body.name)
    .then ( ()=> {
      res.status(200);
    }).catch ( (err)=> {
      zconsole.error(err);
      res.status(500);
    }).finally( ()=> {
      res.end();
    });
}
app.post('/apply-preset', post_apply_preset);

/**
* /fx/set
* [POST] set an FX effect type. returns a call to get_fx
* @body { [part: partid], fx : fx channel id, type: type id, [preset: preset id] }
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
 * POST /controller/plug
 * connect or disconnect midi device
 * @body : {plug: device id, status: desired action, true for connect}
 */
function post_controller_plug(req, res) {
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
app.post('/controller/plug', post_controller_plug);


/**
 * POST /setbinding
 * loads a chain configuration object
 */
function post_set_binding(req, res) {
  zconsole.logPost(req);
  
  if (req.body.id === undefined || req.body.bindings === undefined) {
    res.status(400).end();
    return;
  }
    
  let bindings = req.body.bindings;
  if ( req.body.id == 'session') {
    app.zyntho.midiService.chainSession
    .chain[req.body.id] = req.body.bindings;
  } else {
    app.zyntho.midiService.chainController
      .chain[req.body.id] = req.body.bindings;
  }
  
  app.zyntho.midiService.refreshFilterMap();
  
  //only controllers are saved each time. save session to save session binds.
  if (!app.zyntho.IO.readOnlyMode && req.body.id != 'session')
      app.zyntho.midiService.saveKnotConfiguration(req.body.bindings);
      
  res.status(200).end();
}
app.post ( '/setbinding', post_set_binding);

/**
 * POST /binds/add
 * add a new file or bind to the bind chain without having to download
 * the whole object.
 * @body : {file} load a file or
 * @params {channel} midi channel
 * @params {bind} bind object
 * @params {target} session or controller name
 */
 
function post_binds_add(req, res) {
  zconsole.logPost(req);
  
  if (req.body.file) {
    try {
      let path = app.zyntho.IO.workingDir + "/binds/" + req.body.file;
      app.zyntho.midiService.addBind(path);
      res.status(200).end();
      return;
    } catch (err) {
      zconsole.error(err);
      res.status(500).end();
      return;
    } 
  }
  
  if (req.body.channel && req.body.bind && req.body.target) {
    var obj = ('session' == req.body.target)
      ? app.zyntho.midiService.getSessionBindings()
      : app.zyntho.midiService.chainController.getBindings
        (req.body.target);
      
    if (obj == null) {
      res.status(404).end();
      return;
    }
    
    let bindings = obj.bindings;
    
    if (bindings[req.body.channel] === undefined)
      bindings[req.body.channel] = [];
      
    bindings[req.body.channel].push(req.body.bind);
    app.zyntho.midiService.refreshFilterMap();
    
    if (!app.zyntho.IO.readOnlyMode &&
      req.body.target != 'session')
      app.zyntho.midiService.saveKnotConfiguration(obj);
    
    res.status(200).end();
    
  } else {
    res.status(400).end();
    return;
  }
}
app.post('/binds/add', post_binds_add);

function post_favorites(req,res) {
  zconsole.logPost(req);
  
  if (req.body.favorites === undefined) {
    res.status(400).end();
    return;
  }
  
  app.zyntho.favorites = req.body.favorites;
  app.zyntho.save();
  res.end();
}
app.post('/favorites', post_favorites);

function post_loadbind(req,res) {
  zconsole.logPost(req);
  
  if (req.body.file === undefined) {
    res.status(400).end();
    return;
  }
  
  if (req.body.file.search(/[\/\:]+/) > -1) {
    res.status(403).end();
    return;
  }
  
  let file = `${app.zyntho.IO.workingDir}/binds/${req.body.file}`;
  
  if (!Fs.existsSync(file)) {
    res.status(404).end();
    return;
  }
  
  zconsole.notice(`Replacing session bindings with ${file}`);
   
  try {
    app.zyntho.midiService.chainSession.addBindings('session', file);
    app.zyntho.midiService.refreshFilterMap();
  } catch (err) {
    zconsole.error('Cannot replace bindings: ' + err);
    res.status(501).end();
    return;
  }
  
  res.status(200).end();
}
app.post('/loadbind', post_loadbind);


function post_save_xiz(req,res) {
  zconsole.logPost(req);
   if (app.zyntho.IO.readOnlyMode){
    res.statusMessage='System is read only.';
    res.status(403).end();
    return;
  }  
  
  try {
  ['file', 'bank', 'partID', 'author', 'name', 'program']
    .forEach ( (att) => {
      if ( req.body[att] === undefined)
        throw 'Undefined attribute';
      });
  } catch {
    res.status(400).end();
    return;
  }
  
  if (req.body.bank.search(/[\\\/\:]+/)>-1
      || req.body.file.search(/[\\\/\:]+/)>-1 ) {
    res.statusMessage='Invalid bank/file';
    res.status(401).end();
    return;
  }
  
  let bank = `${app.zyntho.config.bank_dir}${req.body.bank}`;
  zconsole.debug ( bank ) ;
  try { Fs.accessSync(bank, Fs.constants.W_OK) }
  catch ( err ) {
      res.statusMessage='Cannot write on bank.';
      res.status(500).end();
      return;
  }
  
  let filename = req.body.file;
  
  //if program is not in filename, alter filename
  let rex = /^(\d+)\-.*$/;
  if (rex.test(filename) == false) {
    let id = parseInt(req.body.program);
    
    if (id == -1) {
      //turns (valid) filenames into ids
      let ids = Fs.readdirSync (bank).filter ( (file) => 
        (!Fs.statSync(`${bank}/${file}`).isDirectory()
          && rex.test(file)))
        .map ( (file) => parseInt(rex.exec(file)[1]));
      
      id = 1;
      while ( ids.indexOf(id) != -1 && id < 127) id++;
    }
    
    filename = String(id).padStart(4,0)+"-"+filename;
  }
  
  let lines = [];
  if ( req.body.name != '')
    lines.push(`/part${req.body.partID}/Pname '${req.body.name}'`);
  if (req.body.author != '')
    lines.push(`/part${req.body.partID}/info.Pauthor '${req.body.author}'`);

  let promise = null;
  
  if (lines.length > 0) {
    let bundle = app.zyntho.parser.translateLines(lines);
    let worker = new OSCWorker(app.zyntho);
    worker.pushPacket(bundle);
    
    app.zyntho.sendOSC(bundle);  
    promise = worker.listen();
  } else {
    promise = Promise.resolve ( true );
  }
  
  promise.then( ()=>{
    app.zyntho.sendOSC(
      app.zyntho.parser.translate(
        `/save_xiz ${req.body.partID} '${bank}/${filename}'`
      ));
    res.statusMessage = `Saving as ${filename}`;
    res.end();
  }).catch ( (err)=>{
    res.statusMessage = err;
    res.status(500).end();
  });
}
app.post('/save_xiz', post_save_xiz);

/**
 * Generic function to save something inside the zyntho cartridge dir
 * @body { file : filename, data : json data to save }
 */
function post_save(req, res) {
  zconsole.logPost(req);
  if (req.body.file === undefined || req.body.data === undefined
    || req.body.dir == undefined) {
      res.status(400).end();
  }
 
  if (req.body.file.search(/[\\/\:]+/) > -1
      || req.body.dir.search(/[\\\/\:\.]+/)>-1  ) {
      res.statusMessage='Invalid path';
    res.status(403).end();
    return;
  }
  if (app.zyntho.IO.readOnlyMode){
    res.statusMessage='System is read only.';
    res.status(403).end();
    return;
  }  
    
  let path = `${app.zyntho.IO.workingDir}/${req.body.dir}/${req.body.file}`;
   try {
    Fs.writeFile(path, 
      JSON.stringify(req.body.data,null,2), 'utf-8', ()=>{
      res.end();
    });
  } catch (err) {
    zconsole.error(`Cannot save file: ${err}`);
    res.statusMessage='Cannot save!';
    res.status(500).end();
  }
}
app.post('/save', post_save);

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
  
  return get_shutdown( {query : { reboot : true } }, res);
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
      app.zyntho.resyncData();
      res.status(200).end();
    });
    
    app.zyntho.connectToZyn();
  });
  
  app.zyntho.osc.close();
}
app.post('/reconnect', post_reconnect);

function post_session_reset(req,res) {
  zconsole.logPost(req);
  app.zyntho.once ( 'saved' , () => {
    res.end();
  });
    
  app.zyntho.sessionReset();
}

app.post('/session/reset', post_session_reset);

function post_session_load(req, res){
  zconsole.logPost(req);
  if (req.body.file === undefined) {
    res.status(400).end();
    return;
  }
    
  try {
    app.zyntho.sessionLoad(ZynthoIO.sanitizeString(req.body.file));
    res.json(app.zyntho.session);
  } catch ( err ) {
    res.statusMessage = err;
    res.status(500);
  } finally {
    res.end();
  }
}

app.post('/session/load', post_session_load);

function post_session_save(req, res){
  zconsole.logPost(req);
  
  let file = (req.body.file === undefined) 
    ? app.zyntho.config.lastSession
    : ZynthoIO.sanitizeString(req.body.file);
    
  try {
    app.zyntho.sessionSave(file);
  } catch ( err ) {
    res.statusMessage = err;
    res.status(500);
  } finally {
    res.end();
  }
}
app.post('/session/save', post_session_save);

/**
* Updates any extended session parameter
*/
function post_session_set (req, res) {
  zconsole.logPost(req);
  if (req.body.session === undefined) {
    res.status(400).end();
    return;
  }
  
  app.zyntho.session = res.body.session;
  res.end();
}
app.post('/session/set', post_session_set);


//Shutdown default behaviour
function get_shutdown(req,res) {
  zconsole.logPost(req);
  let reboot = (req.query.reboot !== undefined);
  
  new Promise ( (resolve, reject) => {
    app.zyntho.on('saved', resolve);
    app.zyntho.sessionSave();  
  })
  .then ( ()=> {
    if (reboot) {
       zconsole.notice('Rebooting system');
       res.sendFile(__dirname + '/reboot.html');
       exec ('reboot');
      } else {
       zconsole.notice('Shutting down system');
       res.sendFile(__dirname + '/shutdown.html');
       exec ('shutdown 0');
      }  
    });
}
app.get('/shutdown', get_shutdown);

function post_playstyle(req, res) {
  zconsole.logPost(req);
  if (req.body.partID === undefined ||
    req.body.playstyle === undefined) {
    res.status(400).end();
    return;
  }
  
  try {
    app.zyntho.setPlaystyle(req.body.partID, req.body.playstyle);
    res.status(200).end();
  } catch (err) {
    res.statusMessage = err;
    res.status(500).end();
    return;
  }
}
app.post('/playstyle', post_playstyle);

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
