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
    
    /**
     * default 'done' query
     * this query is used to signal that all OSC get mesagges have been
     * received and thus the result can be returned.
     * This is because there is no guarantee AFAIK that bundle or messages
     * will return in the same order they are sent.
     * this done query should *NEVER* be used in a bundle or for real
     * purposes.
     */
    this.defaultDoneQuery = this.parser.translate('/part0/self');
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
      defaultConfig = JSON.parse(Fs.readFileSync(`${frameworkPath}/config.json`);
    } catch (err) {
      throw `Failure in loading path configuration: ${err}`;
    }
    
    //throws if configuration is not available
    this.IO = ZynthoIO.createIOConfig(defaultConfig);
    
    /*
     * if a configuration file is present on the currentDir, override the
     * default configuration. this will NOT take into account cartridge_dir.
     */
    if (this.IO.currentDir.toLowerCase() != frameworkPath.toLowerCase()) {
      console.log('<5> Reading new configuration file.');
      try {
        let data = Fs.readFileSync(`${this.IO.currentDir}/config.json`, 'utf-8');
        this.config = JSON.parse(data);
      } catch (err) {
        throw `Error while reading cartridge configuration: ${err}. Aborting`;
      }  
    } else 
      this.config = defaultConfig;
      
    let favFile = `${this.IO.currentDir}/favorites.json`;
    let configFile = `${this.IO.currentDir}/config.json`;
    
    console.log("opening client on port " + this.config.services.user.zyn_osc_port + "...");
  
    //if favorites.json exists, try to read it
    if (Fs.existsSync(favFile)) {
      console.log('<6> reading favorites...');
      try {
        let data = Fs.readFileSync(this.config.favorites);
        this.favorites = JSON.parse(data);
      } catch (err) {
        console.log (`Cannot read favorites: ${err}`);
        this.favorites = [];
      }
    } else
      this.favorites = [];
    
    //Init osc, bind to custom emitter, try to open
    this.osc = new Osc.UDPPort({
      localAddress: "127.0.0.1",
      localPort: this.config.services.user.osc_local_port,

      remoteAddress: "127.0.0.1",
      remotePort: this.config.services.user.zyn_osc_port,
      metadata: true
    });
    
    this.osc.on('ready', () => {
        console.log ("Opened OSC Server");
        registerOSC(this);
        
        /* Init midi service */
        this.midiService = new ZynthoMidi.ZynthoMidi(this.IO.currentDir,
              this.config);
        console.log ("Started midi service");
        
        //MIDI Device update
        this.midiService.on('device-in', (name) =>{
          
          if (this.config['plugged_devices'] == null)
            this.config['plugged_devices'] = [];
          
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
        
        //MIDI connect to zyn && restore configs
        try {
          this.midiService.connectToZyn();
          console.log("<6> Created zynthomania virtual port.");
        } catch (err) {
          console.log(`<3> Error on creating zynthomania virtual port: ${err}`);
        }
        
        if (this.config.uadsr != null && (this.config.uadsr.type != "none")) {
          try {
            this.midiService.loadUADSR(this.config.uadsr.type);
            console.log("<6> UADSR loaded");
          } catch (err) {
            console.log(`<3> UADSR loading failed: ${err}`);
          }
        }
          
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
       
    });
    
    this.osc.on('error', (err) => {
      throw `OSC ERROR: ${err}`;
    });
    
    /*
     * Main osc event handler
     * translates osc messages to osc events on ZynthoServer
     * if the event is a zynthomania event, the oscEmitter is
     * triggered before to handle the message.
     */
    this.osc.on("osc", (oscMsg) => {
        if (oscMsg.address == this.defaultDoneQuery.address) {
          //console.log("OSC query end.");
          this.emit('query-done', oscMsg);
        } else if (oscMsg.address.match(/^\/zmania/i)){
          console.log("zyntho message on osc");
          let parsed = this.parser.translate(oscMsg.address);
          this.oscEmitter.on(parsed.address, this, parsed.args);
        } else {
          console.log("OSC message: ", oscMsg);
        }
        this.emit(oscMsg.address, oscMsg);
    });

    this.on("error", (err) => {
      console.log(`<3> Zynthomania Event error: ${err}`);
    });

    this.osc.open();
  }
  
  /**
   * getRouteMode
   * returns route mode
   */
   getRoute() {
     if (this.config.route === undefined) {
       this.config.route = {
         fx : [],
         send: 0 //0-127 of send to global
       }
     }
     
     return this.config.route;
   }
   
   /**
    * getDryMode
    * returns dry mode
    */
    getDryMode() {
      if (this.config.dry === undefined)
        this.config.dry = [];
      return this.config.dry;
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
    * ZynthoServer::injects
    * injects an internal get message and binds it to a callback
    * this should work if the OSC 1.0 bundle rule is respected - packets
    * are handled one at time, but no order is guaranteed on bundles.
    */
    
   injectDone(message, onDone) {
      if (Object.prototype.toString.call(message)!=='[object Object]') {
         message = this.parser.translate(message);
      }
       
      if (message.packets === undefined) {
         let bundle = this.parser.emptyBundle();
         bundle.packets.push(message);
         message = bundle;
      } 
      
      message.packets.push(this.defaultDoneQuery);
      this.once('query-done', (msg) => {onDone();})
      return message;
    }
    
  /**
   * ZynthoServer::send
   * sends OSC messages to the synth
   * message: string, object or bundle
   * onDone: if set, a query-done will be send to trigger the event end
   * this is useful if OSC is required to wait for the event but the event
   * does not send anything.
   */
   send(message, onDone) {
     
     if (Object.prototype.toString.call(message)!=='[object Object]') {
       message = this.parser.translate(message);
     }
     
     if (onDone !== undefined) {
       message = this.injectDone(message, onDone);
     }
     
     if (message.address != null && message.address.match(/^\/zmania/)) {
       this.oscEmitter.emit(message.address, this, message.args);
     } else if (message.packets != null 
            && message.packets[0].address.match(/^\/zmania/)){
       //filter packages
       message.packets.forEach( 
        (packet) => this.oscEmitter.emit(packet.address, this, packet.args)
        );
     } else 
      this.osc.send.call(this.osc, message);
   }
   
   
   /**
    * ZynthoServer::bundleBind
    * Utility that binds a bundle to a single callback
    */
    bundleBind(bundle, callback) {
      var _this = this;
      bundle.packets.forEach( (message) => {
        if (message.address == _this.defaultDoneQuery.address)
          return;
        
        _this.on(message.address, (msg) => {callback(msg)});
      })
    }
    
   /**
    * Zynthoserver::query
    * sends get messages to the synth, triggering each message
    * message: string, object or bundle
    * onQuery: if defined, all messages will be bind to this callback. arguments are same of event?
    * onDone: if defined, doneMessage will be send to (supposedly) trigger the event end
    */
   query(message, onQuery, onDone) {
     if (message === undefined)
      throw '::query: undefined message';
     if (Object.prototype.toString.call(message)!=='[object Object]') {
       message = this.parser.translate(message);
     }
     
     var _this = this;
     
     if (onQuery !== undefined && onQuery != null) {
       if (message.packets === undefined) {
         _this.once (message.address, (msg) => {onQuery(msg)});
       } else {
         message.packets.forEach( (address) => {
           _this.once (address, (msg) => {onQuery(msg)});
         });
       }
     }
    
    if (onDone !== undefined && onDone != null) {
      message = this.injectDone(message, onDone);
    }
    this.osc.send(message);
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
                .filter(function (file) {
                    return Fs.statSync(_this.config.bank_dir+'/'+file).isDirectory();
                });
    
    files.forEach(file => { bankList.push(file); });
    
    const customSearchPath = this.IO.currentDir + "/banks";
    
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
            ? this.IO.currentDir + "/banks/"+bank.substr(1)
            : this.config.bank_dir + "/" + bank;
    
    console.log(fullpath);
    
    var files = Fs.readdirSync (fullpath)
                  .filter(function (file) {
                      return !Fs.statSync(fullpath+'/'+file).isDirectory();
                });
          
    var regex = /\d*\-?([^\.]+)\.xiz/;
      
    files.forEach(file => {
      let match = regex.exec(file);
      let name = "";
       
      name = (match != null) ? match[1] : file;   
      result.push ({"name": name, path: fullpath+'/'+file});
    });
      
    return result;
  }
  
  /**
   * Save preferences and favorites
   */
  save() {
    if (this.IO.readOnlyMode) {
      console.log('<5> aborting disk write request.');
      return;
    }
    
    //try to save favorites
    try {
      Fs.writeFileSync(`${this.IO.currentDir}/favorites.json`, JSON.stringify(this.favorites));
    } catch (err) {
      console.log("Could not save favorites: "+ err);
      return false;
    }
    
    //try to save config
    try {
      Fs.writeFileSync(`${this.IO.currentDir}/config.json`, JSON.stringify(this.config, null, 2));
    } catch (err) {
      console.log(`Could not save properties: ${err}`);
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
   * loadInstrument(part, instrumentPath)
   * loads an instrument into a part, then routes all FX
   * if necessary, will enable the instrument
   * if keyboard mode, instrument channel will be routed
   * @partID : part id (0,15)
   * @intrumentPath: file to load
   * @onDone: done callback
   */
   loadInstrument(part, instrumentPath, onDone) {
     let load_xiz = this.parser.translate(`/load_xiz ${part} "${instrumentPath}"`);
     
     this.once('/damage', function (msg) {
       let partID = parseInt(/part(\d+)/.exec(msg.args[0].value)[1]);
       
       //apply routing to this part
       if (this.getRoute().fx.length > 0 || this.getDryMode().length > 0) {
         this.route(partID, undefined, onDone);
       } else if (onDone !== undefined)
        onDone(msg);
     });
     
     this.osc.send(load_xiz);
     this.midiService.loadInstrumentBind(instrumentPath);
   }
   
  

  /**
  * changeFX
  * Changes the current part FX, queries new preset, sends done
  * part: part id
  * fxid : efx id
  * number: new fx (0-8)
  */
  changeFX(part, fxid, efftype, onDone) {
    efftype = (efftype < 0) ? 8 : efftype % 8;
    const newEffName = exports.typeToString(efftype);
    
    const nameQueryString = (part === undefined)
        ? `/sysefx${fxid}` : `/part${part}/partefx${fxid}`;
    
        
    let bundle = this.parser.emptyBundle();
    
    bundle.packets.push(
      this.parser.translate(`${nameQueryString}/efftype ${efftype}`)
    );
    
    /*
     * TODO
     * change to OSCWorker
     */
    if (efftype != 0 && efftype != 7) {
      let presetQuery = `${nameQueryString}/${newEffName}/preset`;
      bundle.packets.push(this.parser.translate(presetQuery));
      
      this.once(presetQuery, (msg) =>{
      //  console.log("called onDone");
        onDone({name : newEffName, preset: msg.args[0].value});
      })
    } else {
      bundle = this.injectDone(bundle, (msg) =>{
        onDone({name : newEffName, preset: -1});
      })
    }
    
    //console.log(JSON.stringify(bundle.packets));
    this.osc.send(bundle);
  } 
  
  /**
  * Prepare a worker with a request for enabled parts, then send
  * the OSC bundle request.
  * @return a worker ready to listen. The worker's availableParts array
  * property will contain the results.
  */
  _getEnabledPartsWorker() {
    const worker = new OSCWorker(this);
    worker.availableParts = [];
    
    const bundle = this.parser.translate('/part[0-15]/Penabled');
    worker.pushPacket(bundle, (add, args) => {
      if (args[0].value)
        worker.availableParts.push(add.match(/^\/part(\d+)/)[1]);
    });
    
    this.osc.send(bundle);
    return worker;
  }
  
  /**
  * queryPartFX
  * queries part fx info, such as effect name, bypass status and preset
  * Those are effectively 3 bundled queries
  * @param partID part to query
  * @param onDone query to call when all is done
  */
  queryPartFX(part, onDone) {
   const returnObject = {
      efx : [{},{},{}]
    };
    const worker = new OSCWorker(this);
    
    let fxQuery = this.parser.emptyBundle();
    
    //Effect type
    let query = this.parser.translate(`/part${part}/partefx[0-2]/efftype`);
    worker.pushPacket(query.packets, (add, args) => {
      let efftype = args[0].value;
      let id = parseInt(RegExp(`\/part${part}\/partefx(\\d)`).exec(add)[1]);
      let name = exports.typeToString(efftype);
      returnObject.efx[id].name = name;
    });
    
    fxQuery.packets = query.packets;
    
    //Bypass
    query = this.parser.translate(`/part${part}/Pefxbypass[0-2]`);
    worker.pushPacket(query.packets, (add, args)=> {
      let bypass = args[0].value;
      try {
        let id = parseInt(add.match(/Pefxbypass(\d)/)[1]);
        returnObject.efx[id].bypass = bypass;
      } catch (err) {
        console.log(`${add}: ${err} - ${id}`);
      }
    });
    
    fxQuery.packets = fxQuery.packets.concat(query.packets);
    
    //System send is handled as part
    query = this.parser.translate(`/Psysefxvol[0-3]/part${part}`);
    worker.pushPacket(query.packets, (add,args) => {  
      if (returnObject.send === undefined)
        returnObject.send = new Array(4);
        
      let id = parseInt(add.match(/Psysefxvol(\d)/)[1]);
      returnObject.send[id] = args[0].value;
    });
    fxQuery.packets = fxQuery.packets.concat(query.packets);
    
    //run before testing preset name
    this.osc.send(fxQuery);
    worker.listen().then( () =>{
      
      //check out presets
      let queries = [];
      returnObject.efx.forEach( (obj) =>{
        if (obj.name != 'None') {
          queries.push(`/part${part}/partefx${returnObject.efx.indexOf(obj)}/${obj.name}/preset`);
        } else
          obj.preset = 0;
      });
      
      query = this.parser.translate(queries);
      const presetCallback = function(add, args) {
        let regexp = RegExp(`\/part${part}\/partefx(\\d)\/(\\w+)`).exec(add);
        let id = parseInt(regexp[1]);
        let name = regexp[2];
        
        //if OSC 1.0 is respected, this should be already ready
        if (name == returnObject.efx[id].name)
          returnObject.efx[id].preset = args[0].value;
      };
      query.packets.forEach( (pack) => {
        worker.push(pack.address, presetCallback);
      });
      this.osc.send(query);
      return worker.listen();
    }).then ( ()=>{onDone(returnObject)});
  }
  
  /**
  * querySystemFX
  * queries part fx info, such as effect name, bypass status and preset
  * Those are effectively 3 bundled queries
  * partID: part to query
  * onDone: query to call when all is done
  * 
  * TODO: Rewrite with OSCWorker
  */
  querySystemFX(onDone) {
   const returnObject = {
      efx : [{},{},{},{}]
    };
    
    let fxQuery = this.parser.translate(`/sysefx[0-3]/efftype`);
    const worker = new OSCWorker(this);
    
    const nameCallback = (add, args) => {
      console.log(`${add} : ${JSON.stringify(args)}`)
      let efftype = args[0].value;
      let id = parseInt(add.match(/sysefx(\d)/)[1]);
      let name = exports.typeToString(efftype);
      returnObject.efx[id].name = name;
    }
    
    for (let i = 0; i < 4; i++)
      worker.push(`/sysefx${i}/efftype`, nameCallback);
    
    this.osc.send(fxQuery);
    worker.listen().then(()=>{
      let queries = [];
      
      const presetCallback = (add, args) => {
        let regexp = /sysefx(\d)\/(\w+)/.exec(add);
        let id = parseInt(regexp[1]);
        let name = regexp[2];
        
        //if OSC 1.0 is respected, this should be already ready
        if (name == returnObject.efx[id].name)
          returnObject.efx[id].preset = args[0].value;
      };
      
      for (let i = 0; i < 4; i++) {
        if (returnObject.efx[i].name != 'None') {
          let query = `/sysefx${i}/${returnObject.efx[i].name}/preset`;
          queries.push(query);
          worker.push(query,presetCallback);
        } else
          returnObject.efx[i].preset = 0;
      }
      
      fxQuery = this.parser.translateLines(queries);
      this.osc.send(fxQuery);
      return worker.listen();
      
    }).then(()=>{onDone(returnObject)});
  }
      
  /**
  * route
  * automatically bypass any part fx if a system fx of the same efftype
  * is present. This will also automatically set the appropriate fx.
  * partID: integer or query []. undefined will find all enabled parts.
  * fxName: fx or array to Parse, if undefined, the preferences.route.fx array will be used.
  * onDone: callback quando si è finito
  * 
  * TODO: rewrite with OSCWorker
  */
  route (partID, fxName, onDone) {
    const worker = new OSCWorker(this);
    
    let partPath = (partID === undefined)
          ? '/part[0-15]/partefx[0-2]'
          : `/part${partID}/partefx[0-2]`;
    
    /* per ogni effetto effetto che combacia, bypass + send appropriato*/
    const fxArray =  (fxName === undefined) 
          ? this.getRoute().fx
          : ((Array.isArray(fxName) ? fxName : [fxName]));
    
    const _this = this;
    const _route = this.getRoute();
    
    //translate dry names into efftype ids
    const _dry = this.getDryMode().map( (fx)=>{ return exports.nameToType(fx);} ) ;
    
    const resultObject = { part : new Array(16), sys: new Array (4)}
    
    /* Query della situazione fx master */
    let masterQuery = this.parser.translate('/sysefx[0-2]/efftype');
    
    const sysQuery = (add,args)=> {
      let masterType = args[0].value;
      let masterChan = parseInt(/sysefx(\d)/.exec(add)[1]);
      resultObject.sys[masterChan] = masterType;
    };
    
    masterQuery.packets.forEach( (pack) =>{
        worker.push(pack.address, sysQuery);
    });
    
    let query = this.parser.translate(`${partPath}/efftype`);
    
    const onPathMessage = (add, args) => {
      let partID = parseInt(/\/part(\d+)/.exec(add)[1]);
      let fxChanID =parseInt(/\/partefx(\d)/.exec(add)[1]);
      
      if (resultObject.part[partID] === undefined)
        resultObject.part[partID] = new Array(3);
      
      resultObject.part[partID][fxChanID] = args[0].value;
    }
    //this.bundleBind(query, onPathMessage);
    
    query.packets.forEach( (pack) =>{
        worker.push(pack.address, onPathMessage);
    });
    
    //merge two queries
    query = this.merge(masterQuery, query);
    
    this.osc.send(query);
    worker.listen().then(()=>{
      var bundle = [];
      
      try {
        let masterType = 0;
        let pefxType = 0;
        for (let sysID = 0; sysID < 4; sysID++) {
          masterType = resultObject.sys[sysID];
           
          if (masterType == 0)
            continue;
          
          for (let partID = 0; partID < 16; partID++) {
            if (resultObject.part[partID] === undefined)
              continue;
            
            for (let fxChanID = 0; fxChanID < 3; fxChanID++) {
              pefxType = resultObject.part[partID][fxChanID];
              if ( pefxType == masterType) {  
                console.log(`ZynthoServer: routing part ${partID} fx ${fxChanID} to system fx ${sysID}`);
                bundle.push ( `/part${partID}/Pefxbypass${fxChanID} T`);
                bundle.push ( `/Psysefxvol${sysID}/part${partID} ${_route.send}`);
              } else if (_dry.indexOf(pefxType) > -1) {
                console.log(`ZynthoServer: drying  part ${partID} of fx ${fxChanID}`);
                bundle.push ( `/part${partID}/Pefxbypass${fxChanID} T`);
              }
            }
          }
        }
      } catch (err) {
        console.log (`<3> ::route: error on executing query: ${err}`)
      }
    
      if (bundle.length > 0) {
        const empty = ()=>{};
        bundle = this.parser.translateLines(bundle);
        bundle.packets.forEach ( (pack) =>{
          worker.push(pack.address, empty);
        });
        
        this.osc.send(bundle);
      }
      
      return worker.listen();
    }).then( ()=>{
      if (onDone !== undefined)
        onDone();
    });
  }
  
  /**
   * runs an osc file
   * @param scriptFile script file. cartridge path is appended.
   */
  runScript(scriptFile) {
    let scriptPath = this.IO.currentDir+"/scripts/"+scriptFile;
    if (!Fs.existsSync(scriptPath))
      throw `<4> ${scriptPath} does not exists.`;
    
    OSCFile.load(scriptPath, (err, data) => {
      if (err)
        console.error(`<4> Script error on ${scriptFile}: ${err}`);
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
    if (packet.address === undefined) { //bundle
      if (packet.packets[0].address.match(/^\/zmania/i))
        packet.packets.forEach( (p) => {this.oscEmitter.emit(p.address, this, p.args)} );
    } else if (packet.address.match(/^\/zmania/i))
      this.oscEmitter.emit(packet.address, this, packet.args)
    else
      this.osc.send.call(this.osc, packet);
  }
  
  /**
   * loads an xmz file from the sessions directory
   * @param file if undefined, default.xmz is loaded
   */
  sessionLoad(file) {
    if (file === undefined)
      file = 'default.xmz';
    
    let sessionPath = `${this.IO.currentDir}/sessions/${file}`;
    if (!Fs.existsSync(sessionPath)) {
      console.log(`<4> cannot find session ${sessionPath}.`);
      return;
    }
    
    //remove previous session bind if present
    if (this.lastSession !== undefined && "default.xmz" != this.lastSession) {
      let lastBindFile = this.lastSession.replaceAll('.xmz', '.json');
      this.midiService.removeBind(`${this.IO.currentDir}/binds/${lastBindFile}`);
    }
    
    //load any non default bind, as default bind is already loaded
    if (file != 'default.xmz') {
      let bindPath = `${this.IO.currentDir}/binds/${file.replaceAll('.xmz','.json')}`;
      if (Fs.existsSync(bindPath)) {
        console.log('<6> found session bind file.');
        try {
          this.midiService.addBind(bindPath);
        } catch (err) {
          console.log(`<3> Cannot add bind session file: ${err}`);
        }
      }
    }
    
    try {
      this.midiService.refreshFilterMap(true);
    } catch (err) {
      console.log(`<3> Cannot refresh filter map upon session load.`);
    }
    
    this.lastSession = file;
    this.once(`/damage`, () =>{
      //see if you need to apply route
      if (this.getRoute().fx.length > 0 || this.getDryMode().length > 0) {
         this.route(partID, undefined);
       }
    });
    
    this.osc.send(this.parser.translate(`/load_xmz '${sessionPath}'`));
  }
  
  /**
   * Save a session file.
   * @param file filename without path. if undefined, default.xmz is used.
   */
  sessionSave(file) {
    if (this.IO.readOnlyMode) {
      console.log('<5> Session save aborted due to read only mode.');
      return;
    }
    
    file = (file === undefined) ? 'default.xmz' : file;
    this.osc.send(`/save_xmz ${this.IO.currentDir}/sessions/${file}`);
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
