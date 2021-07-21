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

const Osc = require('osc');
const Fs = require('fs');
const OSCParser = require ('./parser.js')
const EventEmitter = require('events');

var exports = module.exports = {};

class ZynthoServer extends EventEmitter {
  constructor() {
    super()
    this.preferences = { "user": "pi", "synth": { "port" : "7777" }, "custom_dir": "/home/pi/custom", "bank_dir": "/usr/local/share/zynaddsubfx/banks/" }
    this.favorites = [];
    this.parser = new OSCParser.OSCParser();
    
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
   */
  open(preferencesFile) {
    
    try {
      console.log('reading preferences...');
      let data = Fs.readFileSync('./preferences.json', 'utf-8');
      this.preferences = JSON.parse(data);
    } catch (err) {
      console.log(`Could not read Preferences.json : ${err}`);
      //this.preferences = { "user": "pi", "synth": { "port" : "7777" }, "custom_dir": "/home/pi/custom", "bank_dir": "/usr/local/share/zynaddsubfx/banks/" }
    }

    //if favorites.json exists, try to read it
    if (this.preferences.favorites !== undefined && fileExists(this.preferences.favorites)) {
      console.log('reading favorites...');
      try {
        let data = Fs.readFileSync(this.preferences.favorites);
        this.favorites = JSON.parse(data);
      } catch (err) {
        console.log (`Cannot read favorites: ${err}`);
        this.favorites = [];
      }
    } else {
      this.favorites = [];
    }
    
    //Init osc, bind to custom emitter, try to open
    this.osc = new Osc.UDPPort({
      localAddress: "127.0.0.1",
      localPort: 6666,

      remoteAddress: "127.0.0.1",
      remotePort: this.preferences.synth.port,
      metadata: true
    });
    
    this.osc.on('ready', () => {
        console.log ("Opened OSC Server");
    })
    
    this.osc.on('error', (err) => {
      throw `OSC ERROR: ${err}`;
    });
    
    var _this = this;
    this.osc.on("osc", function (oscMsg) {
        if (oscMsg.address == _this.defaultDoneQuery.address) {
          console.log("OSC query end.");
          _this.emit('query-done', oscMsg);
        } else {
          console.log("OSC message: ", oscMsg);
          _this.emit(oscMsg.address, oscMsg);
        }
    });

    this.on("error", (err) => {
      console.log(`OSC EVENT ERROR: ${err}`);
    });

    this.osc.open();
  }
  
  /**
   * getRouteMode
   * returns route mode
   */
   getRoute() {
     if (this.preferences.route === undefined) {
       this.preferences.route = {
         fx : [],
         send: 0 //0-127 of send to global
       }
     }
     
     return this.preferences.route;
   }
   
   /**
    * getDryMode
    * returns dry mode
    */
    getDryMode() {
      if (this.preferences.dry === undefined)
        this.preferences.dry = [];
      return this.preferences.dry;
    }
    
  /**
  * ZynthoServer::merge
  * merge 2 queries
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
    * ZynthoServer::onDone
    * injects an internal get message and binds it to a callback
    * this should work if the OSC 1.0 bundle rule is respected - packets
    * are handled one at time.
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
    * return array of object: { name | path}
    */
  getBanks() {
    var _this = this;
    var bankList = ['Favorites', 'Custom'];
    var files = Fs.readdirSync (this.preferences.bank_dir)
                .filter(function (file) {
                    return Fs.statSync(_this.preferences.bank_dir+'/'+file).isDirectory();
                });
  
  files.forEach(file => { bankList.push(file); });
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
      
    if ('Custom' == bank) {
    /** TODO **/  
    } else {
      var fullpath = this.preferences.bank_dir + bank;  
      var files = Fs.readdirSync (fullpath)
                  .filter(function (file) {
                      return !Fs.statSync(fullpath+'/'+file).isDirectory();
                  });
          
      var regex = /\d*\-?([^\.]+)\.xiz/;
      
      files.forEach(file => {
         let match = regex.exec(file);
         let name = "";
         
         if (match !== null)
           name = match[1];
         else
           name = file;
           
        result.push ({"name": name, path: fullpath+'/'+file});
      });
    }
    
    return result;
  }
  
  /**
   * Save preferences and favorites
   */
  save() {
    //try to save favorites
    if (this.preferences.favorites !== undefined) {
      try {
        Fs.writeFileSync(this.preferences.favorites, JSON.stringify(this.favorites));
      } catch (err) {
        console.log("Could not save favorites: "+ err);
        return false;
      }
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
   * ZynthoServer::addFavorite
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
   }
   
  
  /**
  * queryPartFX
  * queries part fx info, such as effect name, bypass status and preset
  * Those are effectively 3 bundled queries
  * partID: part to query
  * onDone: query to call when all is done
  */
  queryPartFX(part, onDone) {
   const returnObject = {
      efx : [{},{},{}]
    };
    
    let fxQuery = this.parser.emptyBundle();
    
    let query = this.parser.translate(`/part${part}/partefx[0-2]/efftype`);
    const nameCallback = function(msg) {
      let efftype = msg.args[0].value;
      let id = parseInt(RegExp(`\/part${part}\/partefx(\\d)`).exec(msg.address)[1]);
      let name = exports.typeToString(efftype);
      returnObject.efx[id].name = name;
    }
    this.bundleBind(query, (msg) => {nameCallback(msg)});
    fxQuery.packets = query.packets;
    
    //Bypass
    query = this.parser.translate(`/part${part}/Pefxbypass[0-2]`);
    const bypassCallback = function(msg) {
      let bypass = msg.args[0].value;
      let id = parseInt(RegExp(`\/part${part}\/Pefxbypass(\\d)`).exec(msg.address)[1]);
      returnObject.efx[id].bypass = bypass;
    };
    this.bundleBind(query, (msg) => {bypassCallback(msg)});
    fxQuery.packets = fxQuery.packets.concat(query.packets);
    
    //System send is handled as part
    query = this.parser.translate(`/Psysefxvol[0-3]/part${part}`);
    const sendCallback = function (msg) {
      let regexp = RegExp('\/Psysefxvol(\\d)').exec(msg.address);
      
      if (returnObject.send === undefined)
        returnObject.send = new Array(4);
        
      returnObject.send[parseInt(regexp[1])] = msg.args[0].value;
    }
    this.bundleBind(query, (msg) => {sendCallback(msg)});
    fxQuery.packets = fxQuery.packets.concat(query.packets);
    
    //Preset - generic
    let presetsQuery = this.parser.emptyBundle();
    for (let type = 1; type < 8; type++) {
      let name = exports.typeToString(type);
      let query = this.parser.translate(`/part${part}/partefx[0-2]/${name}/preset`);
      presetsQuery.packets = presetsQuery.packets.concat(query.packets);
    }
    const presetCallback = function(msg) {
      let regexp = RegExp(`\/part${part}\/partefx(\\d)\/(\\w+)`).exec(msg.address);
      let id = parseInt(regexp[1]);
      let name = regexp[2];
      
      //if OSC 1.0 is respected, this should be already ready
      if (name == returnObject.efx[id].name)
        returnObject.efx[id].preset = msg.args[0].value;
    };
    this.bundleBind(presetsQuery, (msg) => {presetCallback(msg)});
    fxQuery.packets = fxQuery.packets.concat(presetsQuery);
    
    fxQuery = this.injectDone(fxQuery, (done) => {
      onDone(returnObject);
    });
    
    this.osc.send(fxQuery);
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
  * querySystemFX
  * queries part fx info, such as effect name, bypass status and preset
  * Those are effectively 3 bundled queries
  * partID: part to query
  * onDone: query to call when all is done
  */
  querySystemFX(onDone) {
   const returnObject = {
      efx : [{},{},{}, {}]
    };
    
    let fxQuery = this.parser.emptyBundle();
    
    let query = this.parser.translate(`/sysefx[0-3]/efftype`);
    const nameCallback = function(msg) {
      let efftype = msg.args[0].value;
      let id = parseInt(/sysefx(\d)/.exec(msg.address)[1]);
      let name = exports.typeToString(efftype);
      returnObject.efx[id].name = name;
    }
    this.bundleBind(query, (msg) => {nameCallback(msg)});
    fxQuery.packets = query.packets;
    
    //Preset - generic
    let presetsQuery = this.parser.emptyBundle();
    for (let type = 1; type < 8; type++) {
      let name = exports.typeToString(type);
      let query = this.parser.translate(`/sysefx[0-2]/${name}/preset`);
      presetsQuery.packets = presetsQuery.packets.concat(query.packets);
    }
    const presetCallback = function(msg) {
      let regexp = /sysefx(\d)\/(\w+)/.exec(msg.address);
      let id = parseInt(regexp[1]);
      let name = regexp[2];
      
      //if OSC 1.0 is respected, this should be already ready
      if (name == returnObject.efx[id].name)
        returnObject.efx[id].preset = msg.args[0].value;
    };
    this.bundleBind(presetsQuery, (msg) => {presetCallback(msg)});
    fxQuery.packets = fxQuery.packets.concat(presetsQuery);
    
    fxQuery = this.injectDone(fxQuery, (done) => {
      onDone(returnObject);
    });
    
    this.osc.send(fxQuery);
  }

  /**
  * dry
  * automatically set bypass to true on each selected fx in
  * all parts.
  * Dry is automatically used by route() to re-route part fx.
  * partID: can be integer or query [x-y] [x,y]
  * fxName: if set, will look for that single FX. Otherwise it will
  * parse all preferences.dry names.
  * 
  * Note that removing a dry state will NOT remove the fx bypass.
  */
  dry(partID, fxName) {
   
  }
     
      
  /**
  * route
  * automatically bypass any part fx if a system fx of the same efftype
  * is present. This will also automatically set the appropriate fx.
  * partID: integer or query []. undefined will find all enabled parts.
  * fxName: fx or array to Parse, if undefined, the preferences.route.fx array will be used.
  * onDone: callback quando si è finito
  */
  route (partID, fxName, onDone) {
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
    this.bundleBind(masterQuery, function (msg) {
      let masterType = msg.args[0].value;
      let masterChan = parseInt(/sysefx(\d)/.exec(msg.address)[1]);
      resultObject.sys[masterChan] = masterType;
    });
    
    let query = this.parser.translate(`${partPath}/efftype`);
    
    const onPathMessage = function (msg) {
      //console.log(`::route:onPathMessage: ${JSON.stringify(msg)}`);
      
      let partID = parseInt(/\/part(\d+)/.exec(msg.address)[1]);
      let fxChanID =parseInt(/\/partefx(\d)/.exec(msg.address)[1]);
      
    //  console.log(`::route:onPathMessage: part ${partID} chan ${fxChanID} status ${JSON.stringify(resultObject.part[partID])}`);
      
      if (resultObject.part[partID] === undefined)
        resultObject.part[partID] = new Array(3);
      
      
      resultObject.part[partID][fxChanID] = msg.args[0].value;
    }
    this.bundleBind(query, onPathMessage);
    
    //console.log(`::route: part fx bundle ${JSON.stringify(query)}`);  
    
    //merge two queries
    query = this.merge(masterQuery, query);
    
    this.query(query, undefined, function () {
      let bundle = _this.parser.emptyBundle();
      
      try {
      for (let sysID = 0; sysID < 4; sysID++) {
        let masterType = resultObject.sys[sysID];
         
        if (masterType == 0)
          continue;
        
        for (let partID = 0; partID < 16; partID++) {
          if (resultObject.part[partID] === undefined)
            continue;
          
          for (let fxChanID = 0; fxChanID < 3; fxChanID++) {
            let pefxType = resultObject.part[partID][fxChanID];
            if ( pefxType == masterType) {  
              console.log(`ZynthoServer: routing part ${partID} fx {$fxChanID} to system fx ${sysID}`);
              bundle.packets.push ( _this.parser.translate (`/part${partID}/Pefxbypass${fxChanID} T`));
              bundle.packets.push ( _this.parser.translate (`/Psysefxvol${sysID}/part${partID} ${_route.send}`));
            } else if (_dry.indexOf(pefxType) > -1) {
              console.log(`ZynthoServer: drying  part ${partID} of fx {$fxChanID}`);
              bundle.packets.push ( _this.parser.translate (`/part${partID}/Pefxbypass${fxChanID} T`));
            }
          }
        }
      }
      
    } catch (err) { console.log (`::route: error on executing query: ${err}`)}
    try {
      
      console.log (`::route: packets ${JSON.stringify(bundle)}`);
      
      if (onDone !== undefined)
      _this.send.call(_this, bundle, onDone);
     else
      _this.send(bundle);
      
    } catch (err)
      { console.log (`::route: error on route send: ${err}`); }
      
    });
  }
}

exports.ZynthoServer = ZynthoServer;

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

/**
 * checks if a file exists
 */
async function fileExists(path) {
  if (path == null) return false;
  try { await Fs.access(path); return true;}
  catch {return false;}
}


