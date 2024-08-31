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

const Fs = require('fs');
const EventEmitter = require('events');
const {execSync, exec} = require("child_process");

const ZynthoIO = require('./io.js');
const zconsole = ZynthoIO.zconsole;

const Osc = require('osc');
const KNOT = require ('./knot/knot.js');
const ZynthoMidi = require ('./midi.js');
const {registerOSC} = require('./osc.js');
const OSCFile = require('./oscfile.js');
const OSCWorker = require('./oscworker.js').OSCWorker;

var exports = module.exports = {};

class ZynthoServer extends EventEmitter {
  constructor() {
    super()
    this.config = undefined;
    this.favorites = [];
    this.parser = new KNOT.OSCParser();
    
    /*
     * OSC emitter is used to capture internal osc commands
     * events are defined as the osc path
     * arguments are the ZynthoServer object, parsed arguments
     */
    this.oscEmitter = new EventEmitter();
   
    /*
    * advanced data for new session
    */
    this.session = ZynthoServer.defaultExtendedSession();
    
    
    /*
    * Adds all zynthomania's internal OSC commands
    */
    registerOSC(this);
  }
   /**
    * ZynthoServer::bundleBind
    * Utility that binds a bundle to a single callback
    */
    bundleBind(bundle, callback) {
      var _this = this;
      bundle.packets.forEach( (message) => {
        _this.on(message.address, (msg) => {callback(msg)});
      })
    }
    
  static defaultExtendedSession() {
    return {
      instruments : [],
      tempo : 120,
      splitChannel : 0
    };
  }
  /**
   * ZynthoServer::open
   * open preferences file and OSC connection
   * @param frameworkPath path to configuration file
   * @throws error on configuration loading
   */
  open(frameworkPath) {
    if (frameworkPath === undefined || !Fs.existsSync(`${frameworkPath}/config.json`))
      throw "Missing configuration file";
    
    let defaultConfig;
    try {
      defaultConfig = JSON.parse(Fs.readFileSync(`${frameworkPath}/config.json`));
    } catch (err) {
      throw `Failure in loading path configuration: ${err}`;
    }
    
    //throws if configuration is not available
    this.IO = ZynthoIO.createIOConfig(defaultConfig);
    
    /*
     * if a configuration file is present on the workingDir, override the
     * default configuration. this will NOT take into account cartridge_dir.
     */
    if (this.IO.workingDir.toLowerCase() != frameworkPath.toLowerCase()) {
      zconsole.log(`New working path: ${this.IO.workingDir}`);
      
      zconsole.debug('Reading new configuration file.');
      try {
        let data = Fs.readFileSync(`${this.IO.workingDir}/config.json`, 'utf-8');
        this.config = JSON.parse(data);
      } catch (err) {
        throw `Error while reading cartridge configuration: ${err}. Aborting`;
      }  
    } else 
      this.config = defaultConfig;
      
    let favFile = `${this.IO.workingDir}/favorites.json`;
    let configFile = `${this.IO.workingDir}/config.json`;
    let fxFile = `${this.IO.workingDir}/fx.json`;
    
    zconsole.log("opening client on port " + this.config.services.user.zyn_osc_port + "...");
  
    //if favorites.json exists, try to read it
    if (Fs.existsSync(favFile)) {
      zconsole.debug('Reading favorites...');
      try {
        let data = Fs.readFileSync(favFile);
        this.favorites = JSON.parse(data);
      } catch (err) {
        zconsole.warning(`Cannot read favorites: ${err}`);
        this.favorites = [];
      }
    } else
      this.favorites = [];
    
    if (Fs.existsSync(fxFile)) {
      zconsole.debug('loading custom fx specs...');
      try {
        this.fxConfig = JSON.parse(
          Fs.readFileSync(fxFile) );
      } catch (err) {
        zconsole.error(`Cannot read fx specs: ${err}`);
        this.fxConfig = null;
      }
    }
    
    /* Init midi service */
    this.midiService = new ZynthoMidi.ZynthoMidi(this.IO.workingDir,
          this.config);
    zconsole.log ("Started midi service");
    
    //Register MIDI Device update events
    this.midiService.on('device-in', (name) =>{
      
      if (this.config['plugged_devices'] == null){
        this.config['plugged_devices'] = [];
        this.midiService.midiInputDevices = this.config['plugged_devices'];
      }
      
      if (this.config['plugged_devices'].indexOf(name) == -1) {
        this.config['plugged_devices'].push(name);
        this.save();
      }
    });
    
    this.midiService.on('device-out', (name) =>{
      if (this.config['plugged_devices'] != null) {
        let index = this.config['plugged_devices'].indexOf(name);
        if (index != -1)
          this.config['plugged_devices'].splice(index,1);
        
        this.save();
      }
    });
    
    //Start the auto-plug service - should this run forever?
    this.autoPlugService = setInterval(function(midiService){
      midiService.syncPluggedDevices();
    }, 2000, this.midiService);
    
          
    /*
     * Capture all /zmania/ osc messages from binds
     * all other binds goes to regular osc
    */
    this.midiService.knot.on('osc', (packet) => {
      if (!Array.isArray(packet))
        packet = [packet];
      
      //console.log(`midi osc : ${JSON.stringify(packet)}`);
      
      let zmaniaHandler = packet.filter( (path) => path.match(/^\/zmania/));
      packet = (zmaniaHandler.length > 0)
          ? packet.filter( (path) => (zmaniaHandler.indexOf(path)>-1))
          : packet;
      
      this.osc.send.call(this.osc, this.parser.translate(packet));
      
      //send internally osc messages
      zmaniaHandler.forEach( (path) => {
        let tPath = this.parser.translate(path);
        this.oscEmitter.emit(tPath.address, this, tPath.args);
      });
    });

    //Capture damage events
    this.on('/damage', (msg)=> {
      let match = msg.args[0].value.match(/^\/part(\d+)\/$/);
      if (match != null) {
        console.log('Request for part clearance')
        this.resetPartData(match[1]);
      }
    })
    
    this.on("error", (err) => {
      zconsole.warning(`Zynthomania Event error: ${err}`);
    });
    
    this.connectToZyn();
  }
  
  /*
    Attemps a connection with ZynAddSubFX and starts
      listening.
  */
  connectToZyn() {
    //Init osc, bind to custom emitter, try to open
    this.osc = new Osc.UDPPort({
      localAddress: "127.0.0.1",
      localPort: this.config.services.user.osc_local_port,

      remoteAddress: "127.0.0.1",
      remotePort: this.config.services.user.zyn_osc_port,
      metadata: true
    });
    
    /*
      POST-OSC initialization
    */
    this.osc.on('ready', () => {
        zconsole.log ("Opened OSC Server");
        
        //MIDI connect to zyn && restore configs
        try {
          this.midiService.connectToZyn();
          zconsole.log("Created zynthomania virtual port.");
        } catch (err) {
          zconsole.error(`Error on creating zynthomania virtual port: ${err}`);
        }
        
       /*
        * See if the default session is present
        */
        let defSes = `${this.IO.workingDir}/sessions/default.xmz`;
        if (Fs.existsSync(defSes)) {
          zconsole.log('Loading default session.');
          try {
            this.sessionLoad('default.xmz');
          } catch (err) {
            zconsole.warning(`Error on loading default session : ${err}`);
          }
        }
        
        this.emit('ready');
    });
    
    this.osc.on('error', (err) => {
      //throw `OSC ERROR: ${err}`;
      zconsole.error(`OSC ERROR: ${err}`);
      zconsole.log(err.stack);
    });
    
    /*
     * Main osc event handler
     * translates osc messages to osc events on ZynthoServer
     * if the event is a zynthomania event, the oscEmitter is
     * triggered before to handle the message.
     */
    this.osc.on("osc", (oscMsg) => {
      /*
        if (oscMsg.address.match(/^\/zmania/i)){
          zconsole.debug(`zyntho message on osc: ${oscMsg.address}`);
          //let parsed = this.parser.translate(oscMsg.address);
          
          //this.oscEmitter.on(parsed.address, this, parsed.args);
        } else {
          
          
        }
        */
      //DEBUG ONLY: Skip zyn-fusion /active_keys
      //REMOVEME!!
      if (oscMsg.address != '/active_keys')
        zconsole.log(`OSC message: ${oscMsg.address} ${JSON.stringify(oscMsg.args.map( (e) => e.value))}`);
      this.emit(oscMsg.address, oscMsg);
    });

    

    //Let's go!
    this.osc.open();
  }
 
 
  /**
   * ZynthoServer::getFX
  * @params path must be a discrete path such as part0/partefx1 or /systemefx0
  * 
  */
  getFX(path) {
    const result = {};
    let typeWorker = new OSCWorker(this);
    let efftypepacket = this.parser.translate(`${path}/efftype`);
    
    typeWorker.pushPacket (efftypepacket, (address, args) => {
       result.efftype = args[0].value;
    });
    
    this.osc.send(efftypepacket);
    return typeWorker.listen().then( ()=> {
      if ( result.efftype == 0) {
        result.name = 'None';
        return Promise.resolve(result);
      }
      
      result.name = exports.typeToString(result.efftype);
      if (this.fxConfig == null)
        return Promise.resolve ( result );
      
      result.config = this.fxConfig[result.name];
      
      let cfg = result.config;
      if ('algorithm' in cfg)
        result.algorithm =  cfg.algorithm;

      
      let fxQuery = this.parser.emptyBundle();
      let worker = new OSCWorker(this);
   
      fxQuery.packets = fxQuery.packets.concat(
        this.parser.translate(`${path}/parameter[0-1]`).packets, 
        [
          this.parser.translate(`${path}/preset`),
          this.parser.translate(`${path}/parameter${cfg.reagent}`),
          this.parser.translate(`${path}/parameter${cfg.catalyst}`),
          this.parser.translate(`${path}/parameter${cfg.acid}`),
          this.parser.translate(`${path}/parameter${cfg.base}`),
          this.parser.translate(`${path}/numerator`),
          this.parser.translate(`${path}/denominator`),
        ]
      );
      
      if (cfg.algorithm.length > 0) {
        fxQuery.packets.push(
          this.parser.translate(`${path}/parameter${cfg.formula}`));
      }
      
      result.osc = {};
      worker.pushPacket(fxQuery, (address, args) =>{
        zconsole.debug(`${address}: ${args[0]}`);
        result.osc[address] = args[0];
      });
      
      if (path.startsWith('/part')) {
        let rex=/^\/part(\d+)\/partefx(\d)/.exec(path);
        let partID = rex[1];
        let fxID = rex[2];
        let additionalPacket =
          this.parser.translate(`/part${partID}/Pefxbypass${fxID}`);
        worker.pushPacket(additionalPacket,
          ( address, args) => {
            result.bypass = args[0].value;
          });
        fxQuery.packets.push(additionalPacket);
    
      } else {
        result.bypass = undefined;
      }
        
      this.osc.send(fxQuery);
      return worker.listen();
    }).then ( ()=> {return result;} );
  }
  
  /**
  * ZynthoServer::merge
  * merge 2 osc messages/bundles
  * @returns merged bundle
  */
  merge(queryA, queryB) {
    let result;
    if (queryA.packets === undefined) {
     result = this.parser.emptyBundle();
     result.packets.push(queryA);
    } else 
      result = { ...queryA };
    
    if (queryB.packets === undefined)
      result.packets.push(queryB);
    else
      result.packets = result.packets.concat(queryB.packets);
    
    return result;
  }
  
   
  
   /**
    * Zynthoserver::getBanks
    * retrieve all banks name with path
    * @return array of objects: {name | path}
    */
  getBanks() {
    var _this = this;
    var bankList = ['Favorites'];
    var files = Fs.readdirSync (this.config.bank_dir)
                .filter(
                  (file) => Fs.statSync(this.config.bank_dir+'/'+file)
                    .isDirectory()
                );
    
    files.forEach(file => { bankList.push(file); });
    
    const customSearchPath = this.IO.workingDir + "/banks";
    
    if (Fs.existsSync(customSearchPath)){
      files = Fs.readdirSync (customSearchPath)
                .filter( (file) => {
                    return Fs.statSync(customSearchPath+'/'+file).isDirectory();
                });
      files.forEach(file => { bankList.push("$"+file); });
    }
    
    return bankList;
  }
  
  /**
   * Zynthoserver::getInstruments
   * retrieve all instrument name by filename
   */
  getInstruments(bank) {
    if ('Favorites' === bank)
      return this.favorites;
      
    let result = [];
    var fullpath = ("$" == bank[0])
            ? this.IO.workingDir + "/banks/"+bank.substr(1)
            : this.config.bank_dir + "/" + bank;
    
//    zconsole.debug(fullpath);
    
    var files = Fs.readdirSync (fullpath)
                  .filter(
                    file => !Fs.statSync(fullpath+'/'+file).isDirectory()
                  );
          
    var regex = /(\d*)\-?([^\.]+)\.xiz/;
      
    files.forEach(file => {
      let match = regex.exec(file);
      let name = "";
       
      name = (match != null) ? `${match[1].slice(1)}: ${match[2]}` : file;   
      result.push ({"name": name, path: fullpath+'/'+file});
    });
      
    return result;
  }
  
  /**
   * Save preferences and favorites
   */
  save() {
    if (this.IO.readOnlyMode) {
      zconsole.notice('Aborting disk write request.');
      return;
    }
    
    //try to save favorites
    try {
      Fs.writeFileSync(`${this.IO.workingDir}/favorites.json`, JSON.stringify(this.favorites));
    } catch (err) {
      zconsole.error("Could not save favorites: "+ err);
      return false;
    }
    
    //try to save config
    try {
      Fs.writeFileSync(`${this.IO.workingDir}/config.json`, JSON.stringify(this.config, null, 2));
    } catch (err) {
      zconsole.error(`Could not save properties: ${err}`);
    }
  }
  
  /**
  * ZynthoServer::addFavorite
  * adds a favorite
  * returns true if the favorite is set, false if it was already set
  */
  addFavorite(entry) {
    if (Array.isArray(this.favorites)) {
      this.favorites.forEach( (item) => {
        if (item.path == entry.path)
          return false;
      });
    } else
      this.favorites = [];
    
    this.favorites.push(entry);
    
    //save changes
    this.save();
    return true;
  }
    
  /**
   * ZynthoServer::removeFavorite
   * adds a favorite
   * returns true if the favorite is removed, false if it was already set
   */
  removeFavorite(entry) {
      var newFavs = this.favorites.filter(item => item.path != entry.path);
      
      if (this.favorites.length == newFavs.length)
        return false;
      else {
        this.favorites = newFavs;
        this.save();
        return true;
      }
    }
    
    /**
    * Reset any extended info on part
    * This is called by listening to a part damage
    */
  resetPartData(partID) {
    zconsole.log(`Resetting part ${partID}`);
    this.session.instruments[partID] = null;
    this.emit('part-reset', partID);
  }
    
  /**
   * loadInstrument(part, instrumentPath)
   * loads an instrument into a part
   * if necessary, will enable the instrument
   * if keyboard mode, instrument channel will be routed
   * @param part : part id (0,15)
   * @param intrumentPath: file to load
   * @param onDone: done callback
   */
   loadInstrument(part, instrumentPath, onDone) {
     
    let load_xiz = this.parser.translateLines(
      [`/load_xiz ${part} "${instrumentPath}"`, `/part${part}/Penabled T`]
    );
    
    this.on('part-reset', (partID) => {
      this.session.instruments[part] = {
          path : instrumentPath
      }
      this.once(`/part${part}/Pname`, (msg) => {
       this.session.instruments[part].name = msg.args[0].value;
       
      
       if (onDone !== undefined)
        onDone(msg);
      });
       
       this.osc.send(this.parser.translate(`/part${part}/Pname`));
    });
     
    this.osc.send(load_xiz);
    //this.midiService.loadInstrumentBind(instrumentPath);
   }
   
   getInstrumentNameFromFile(index) {
      if (this.session.instruments[index] == null)
        this.session.instruments[index] = {};
      return this.session.instruments[index];
   }
  
  /**
  * queryPartFX
  * queries part fx info, such as effect name, bypass status and preset
  * Those are effectively 3 bundled queries
  * @param partID part to query
  * @param onDone query to call when all is done
  * @return a promise with the data
  */
  queryPartFX(part) {
    /*
     * We populate a listener (worker), to handle different osc signals
     * differently so we can populate the result object.
     */
     
   const returnObject = {
      efx : [{},{},{}]
    };
    
    const worker = new OSCWorker(this);
    let fxQuery = this.parser.emptyBundle();
    
    let query = this.parser.translate(`/part${part}/partefx[0-2]/efftype`);
    
    //When listening to effect type, check out the effect name.
    worker.pushPacket(query, (add, args) => {
      let efftype = args[0].value;
      let id = parseInt(RegExp(`\/part${part}\/partefx(\\d)`).exec(add)[1]);
      let name = exports.typeToString(efftype);
      returnObject.efx[id].name = name;
    });
    
    fxQuery.packets = query.packets;
    
    //Bypass
    query = this.parser.translate(`/part${part}/Pefxbypass[0-2]`);
    worker.pushPacket(query, (add, args)=> {
      let bypass = args[0].value;
      try {
        let id = parseInt(add.match(/Pefxbypass(\d)/)[1]);
        returnObject.efx[id].bypass = bypass;
      } catch (err) {
        zconsole.warning(`queryPartFX: mismatch. ${add}: ${err} - ${id}`);
      }
    });
    
    fxQuery.packets = fxQuery.packets.concat(query.packets);
    
    query = this.parser.translate(`/part${part}/Pefxroute[0-2]`);
    worker.pushPacket(query, (add, args)=> {
      let route = args[0].value;
      try {
        let id = parseInt(add.match(/Pefxroute(\d)/)[1]);
        returnObject.efx[id].route = route;
      } catch (err) {
        zconsole.warning(`queryPartFX: mismatch. ${add}: ${err} - ${id}`);
      }
    });
    
    fxQuery.packets = fxQuery.packets.concat(query.packets);
    
    //System send
    query = this.parser.translate(`/Psysefxvol[0-3]/part${part}`);
    worker.pushPacket(query, (add,args) => {  
      if (returnObject.send === undefined)
        returnObject.send = new Array(4);
        
      let id = parseInt(add.match(/Psysefxvol(\d)/)[1]);
      returnObject.send[id] = args[0].value;
    });
    fxQuery.packets = fxQuery.packets.concat(query.packets);
    
    //run before testing preset name
    this.osc.send(fxQuery);
    
   //we don't listen to preset anymore.
   return worker.listen().then ( () => { return returnObject} );
  }
  
 
  /**
   * runs an osc file
   * @param scriptFile script file. cartridge path is appended.
   */
  runScript(scriptFile) {
    let scriptPath = this.IO.workingDir+"/scripts/"+scriptFile;
    if (!Fs.existsSync(scriptPath))
      throw `<4> ${scriptPath} does not exists.`;
    
    OSCFile.load(scriptPath, (err, data) => {
      if (err)
        zconsole.error(`<4> Script error on ${scriptFile}: ${err}`);
      else {
       this.sendOSC(data);
      }
    });
  }
  
  /**
   * sendOSC
   * filters zynthomania osc packets and handles them
   * @param packet single osc message or bundle
   */
  sendOSC(packet) {
    if (packet == null) {
      zconsole.error('Invalid packet');
      return;
    }
    
    let filteredBundle = this.parser.emptyBundle();
    
    //check if multiple packets or not
    //filtering should allow mixed packets
    
    if (packet.address === undefined) {
        packet.packets.forEach( (p) => {
          if (packet.packets[0].address.match(/^\/zmania/i)) {
            zconsole.debug(`zyntho message on send-osc: ${p.address}`);
            this.oscEmitter.emit(p.address, this, p.args)
          } else {
            filteredBundle.packets.push(p);
          }
        });
        
      if (filteredBundle.packets.length > 0)
        this.osc.send.call(this.osc, filteredBundle);
      
      return;
    } else if (packet.address.match(/^\/zmania/i)) {
      zconsole.debug(`single zyntho message on send-osc: ${packet.address}`);
      this.oscEmitter.emit(packet.address, this, packet.args);
      return;
    }
    
    this.osc.send.call(this.osc, packet);
  }
  
  /**
   * loads an xmz file from the sessions directory
   * @param file if undefined, default.xmz is loaded
   */
  sessionLoad(file) {
    if (file === undefined)
      file = 'default.xmz';
    
    let sessionPath = `${this.IO.workingDir}/sessions/${file}`;
    if (!Fs.existsSync(sessionPath)) {
      zconsole.warning(`Cannot find session ${sessionPath}.`);
      return;
    }
    
    //(Un)load session binds
    let bindPath = 
      `${this.IO.workingDir}/binds/${file.replaceAll('.xmz','.json')}`;
    if (Fs.existsSync(bindPath))
      this.midiService.loadSessionBind(bindPath);
    else
      this.midiService.loadSessionBind(null);

    try {
      this.midiService.refreshFilterMap(true);
    } catch (err) {
      zconsole.error(`Cannot refresh filter map upon session load.`);
    }
    
    this.lastSession = file;
    

    //Load actual XMZ
    this.osc.send(this.parser.translate(`/load_xmz '${sessionPath}'`));
    
    //Loads extra session data
    let sessionJson = sessionPath.replace(/xmz$/,'json');
    if (Fs.existsSync(sessionJson)) {
       zconsole.log('Loading extended data...');
       try {
         this.session = JSON.parse(Fs.readFileSync(sessionJson));
       } catch (err) {
         zconsole.warning(`File ${sessionJson} was not readable: ${err}. Skipping.`);
         this.session = ZynthoServer.defaultExtendedSession();
       }
    } else
       this.session = ZynthoServer.defaultExtendedSession();
  }
  
  /**
   * Saves a Zynthomania session. A zyntho session is composed by
   * 1) a xmz file with zynaddsubfx status, 2) additional configuration
   * 3) midi bindings.
   * Also, it will emit a 'saved' event.
   * @param file filename without path. if undefined, default.xmz is used.
   */
  sessionSave(file) {
    if (this.IO.readOnlyMode) {
      throw 'Session save aborted due to read only mode.';
    }
    
    file = (file === undefined) ? 'default.xmz' : file;
    
    // Extra session data   
    let extfile = file.replace(/xmz$/,'json');
    try {
      Fs.writeFileSync(`${this.IO.workingDir}/sessions/${extfile}`, JSON.stringify(this.session));
    } catch (err) {
      zconsole.warning(`Could not save extended session data: ${err}`);
    }
    
    //Session binds
    this.midiService.getSessionBindings().file =
      `${this.midiService.cartridgeDir}/${extfile}`;
      
    this.midiService.saveKnotConfiguration(
      this.midiService.getSessionBindings());
    
    /*
    if (this.midiService.sessionConfig != null) {
      zconsole.notice('Session binds found and will be saved.s');
      try {
        Fs.writeFileSync(`${this.IO.workingDir}/binds/${extfile}`, JSON.stringify(this.midiService.sessionConfig));
      } catch (err) {
        zconsole.warning(`Could not save session bind: ${err}`);
      }
    }
    */
    var dummyFileSave = `${this.IO.workingDir}/sessions/__dummy__${file}`,
        file = `${this.IO.workingDir}/sessions/${file}`;
    
    this.osc.send(this.parser.translate(
      `/save_xmz '${dummyFileSave}'`
    ));
   
    var dummySize = 0;
    var intervalID = null;
    //check out when dummy file stabilizes then emit a save event.

    intervalID = setInterval( (zyntho) => { 
      
      //avoid race condition
        if (!Fs.existsSync(dummyFileSave)){    
          return;
        }
        let newSize = Fs.statSync(dummyFileSave);
        
        //save completed
        if (dummySize == newSize.size && newSize.size > 0) {
          zconsole.debug('File save complete.');
          
          clearInterval(intervalID);
          
          //replace file
          if (Fs.existsSync(file))
              Fs.rmSync(file);
          Fs.renameSync(dummyFileSave, file);
          
          zyntho.emit('saved', file);
        } else {
          zconsole.log(`Save incomplete: ${dummySize}/${newSize.size}`);
          dummySize = newSize.size;
        }
      },500, this);
  }

}

exports.ZynthoServer = ZynthoServer;

/**
 * Converts an fx id to a fx Name.
 * @param type number from 0 to 8
 * @returns a string with fx name
 */
exports.typeToString = function(type) {
  switch (type) {
     case 0: return 'None'; break;
     case 1: return 'Reverb'; break;
     case 2: return 'Echo'; break;
     case 3: return 'Chorus'; break;
     case 4: return 'Phaser'; break;
     case 5: return 'Alienwah'; break;
     case 6: return 'Distorsion'; break;
     case 7: return 'EQ'; break;
     case 8: return 'DynamicFilter'; break;
     default: return `Unk (${type})`; break;
  }
}

/**
 * Converts a fx name to an fx id
 * @param name a string formatted with Capital first letter
 * @returns an id
 */
exports.nameToType = function(name) {
  switch( name ) {
    case 'None': return 0;
    case 'Reverb': return 1;
    case 'Echo': return 2;
    case 'Chorus': return 3;
    case 'Phaser': return 4;
    case 'Alienwah': return 5;
    case 'Distorsion': return 6;
    case 'EQ': return 7;
    case 'DynamicFilter': return 8;
    default: return -1;
  }
}
