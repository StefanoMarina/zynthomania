/*********************************************************************
 * Zynthomania MIDI Manager
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
const EventEmitter = require('events');
const {execSync, exec} = require("child_process");
const Fs = require('fs');
const MIDI = require('midi');

const KNOT = require('./knot/knot.js');
const ZynthoIO = require('./io.js');
const zconsole = ZynthoIO.zconsole;

const {UADSR4, UADSR8} = require ('./uadsr.js');

var exports = module.exports = {};
 
 /**
  * Knot configuration chain
  */
 class KnotChain {
   constructor() {
     this.chain = {};
   }
   
   /**
    * adds a new filter configuration
    * @params id a valid id
    * @params file (opt) KNOT file
    */
   addBindings(id, path=null) {
     var knotConfig = null;
     
     if ( path != null) {
       if (!Fs.existsSync(path))
         throw `KnotChain::addBindings: missing file ${path}` ; 
       try {
         knotConfig = JSON.parse(Fs.readFileSync(path));
       }catch (err) {
         zconsole.error(`KnotChain::addBindings: failure in loading file '${path}': ${err}`);
       }
     } else {
       knotConfig = {};
     }
     
     if (knotConfig != null)
      this.chain[id] = { 'id' : id, 'file' : path, 'bindings' : knotConfig,
          'enabled' : true};
   }
   
   getBindings(id) {
     return this.chain[id];
   }
   
   getChainElements() {
     return Object.keys(this.chain);
   }
   
   /**
    * removes a binding map from the chain
    */
    deleteMap(id) {
      if (Object.keys(this.chain).indexOf(id) < 0){
        zconsole.error(`KnotChain: cannot find id ${id}`);
        return;
      }
      
      delete this.filters[id];
   }
   
    createFilterMap() {
      if ( Object.keys(this.chain).length == 0)
        return new KNOT.FilterMap();
     
     return  Object.values(this.chain)
        .filter( (obj) => obj.enabled )
        .reduce ( (merge, obj) =>  (( merge != null) 
          ? KNOT.FilterMap.merge(merge,
              new KNOT.FilterMap(obj.bindings))
          : new KNOT.FilterMap(obj.bindings))
        , null);

   }
 }
 
/* 
 * Note - Filter chain of version 1.0
 * [default.json]>[static filters]>[midi filter]>[uadsr]>[instrument]>[session]
 * Filter chain of version 2.0
 * [ controllers ] - [session/file] - [instrument!]
 */
   
class ZynthoMidi extends EventEmitter {
  
  constructor(IODir, config) {
    super();
    this.midiConnections = {};
    
    this.midiInput = null;
    this.midiOutput = null;
    this.knot = new KNOT.Knot(null);
    this.knot.setEmitOnly(true);
    
    /*
     * List of all active bindings files. controller names get replaced.
     */
    this.chainController = new KnotChain();
    this.chainSession = new KnotChain();
    
    //default session map
    (Fs.existsSync(this.cartridgeDir + "/default.json")) 
    this.chainSession.addBindings('session');
    
    this.filterList = [];
    this.baseFilterMap = null;
    //Midi instrument map. still single map
    this.instrumentMap = null;
    //Session map. this is the currently edited session.
    this.sessionMap = null;
    //Session config. this is the currently edited session.
    this.sessionConfig = null;
    
    this.cartridgeDir = IODir + "/binds";
    
    /*if (Fs.existsSync(this.cartridgeDir + "/default.json")) {
      this.filterList.push(this.cartridgeDir + "/default.json");
      this.basefilterMap = new KNOT.FilterMap(this.filterList[0]);
    }*/
    
    this.oscParser = new KNOT.OSCParser();
    this.uadsrConfig = config.uadsr;
    this.midiInputDevices = config.plugged_devices;
    
    //console.log (`ZMIDI: build ${JSON.stringify(this.uadsrConfig)}`); 
  }
  
   /**
   * adds a bind file and refresh current session.
   * @param path full path to .json file.
   * @return false if file does not exist or is already present in the queue.
   */
  addBind(path) {
    if (!Fs.existsSync(path) || this.filterList.indexOf(path)>=0){
      zconsole.notice(`addBind: missing file or file already present ${path}`);
      return false;
    }
    
    this.chainSession.addBindings(path, path);
    
    //this.filterList.push(path);
    this.refreshFilterMap(true);
    return true;
  }
  
  /**
   * Creates a virtual port called 'Zynthomania' and connects it to
   * ZynAddSubFX. This port will filter any incoming message through
   * knot before sending anything.
   * If a new virtual port is opened, it will be connect to the synth
   * via system call to aconnect.
   * @param force (default=false) force close/reopening of virtual port.
   */
  connectToZyn(force){
    if (force === undefined) force = false;
    
    let midi = this.getMidiOutput();
    
    if (midi == null) {
      zconsole.critical('Virtual midi port is not allocated');
      throw 'Virtual midi port is not allocated';
    }
    
    //no need to recreate midi
    if (midi.isPortOpen() && force)
      midi.closePort();
      
    if (!midi.isPortOpen()) {
      midi.openVirtualPort('Zynthomania');
      this.knot.setMidiOut(midi);
      
      // Start-up midi devices
      if (this.midiInputDevices != null)
        this.syncPluggedDevices();
    }
    
    // Connect midi to ZynAddSubFX
    exec("aconnect 'RtMidi Output Client:Zynthomania' 'ZynAddSubFX'");
  }
    
   /**
   * Get a list of available input devices, and their actual connection
   * with zynthomania or zynaddsubfx
   * @returns an array of midi devices
  */
  enumerateInputs() {
    //zconsole.debug("enumerateInputs: Attemping access to MIDI");
    let midi = this.getMidiInput();
    let q = midi.getPortCount();
    var result = [];
    let connectedInputs = Object.keys(this.midiConnections);
    let portName = "", displayName;
    let status = false;
    
    for (let i = 0; i < q; i++) {
      portName = midi.getPortName(i);
      if (portName.match(/Zynthomania/g))
        continue;
      displayName = portName.match(/[^:]+:(.*) \d+:\d+.*/)[1];
      status = (connectedInputs.indexOf(portName)>-1);
      result.push({name : displayName, port: portName, connected: status});
    }
    
    
    return result;
  }
  
  getSessionBindings() {
    return this.chainSession.chain['session'];
  }
  
  /**
   * getMidiInput
   * @returns the object's midi input object
   */
  getMidiInput() {
    if (this.midiInput == null)
      this.midiInput = new MIDI.Input();
      
    return this.midiInput;
  }
  
  getMidiOutput() {
    if (this.midiOutput == null)
      this.midiOutput = new MIDI.Output();
    
    return this.midiOutput;
  }
  
  getUADSR() {
    if (this._uadsr == null || this.uadsrConfig.type == 'none')
      throw "UADSR is not loaded.\n";
    else
      return this._uadsr;
  }
  
  /**
   * Sets or clears the current instrument bind. this will change the
   * current chain by applying the pre-generated static chain with the
   * last filterMap.
   * @param instrument instrument file name with full path
   */
  loadInstrumentBind(instrument) {
    if (this.cartridgeDir == null)  return;
    
    //Instrument bind file must be exactly as the .xiz file
    let bindFile = this.cartridgeDir+"/"
          +instrument.match(/[^\/]+$/)[0].match(/[^\.]+/)[0]+".json";
    
    let fileExists = Fs.existsSync(bindFile);
    
    if ( (!fileExists && this.instrumentMap != null)
        || (this.instrumentMap != null && instrument == null)) {
      this.instrumentMap = null;
    } else if (fileExists){
      zconsole.log(`Loading instrument bind ${bindFile}`);
      try {
        this.instrumentMap = new KNOT.FilterMap(JSON.parse(
          Fs.readFileSync(bindFile) ));
      } catch (err) {
        this.instrumentMap = null;
        zconsole.warning(`Failed loading bindings ${bindFile}:${err}`);
      }
    }
    
    this.refreshFilterMap(false);
  }
  
  /**
   * loadUADSR
   * Loads unified ASDR mode
   * @param type adsr type (uadsr4 or uasdr8 or none)
   * @param config configuration (optional)
   * @throws if configuration is not defined in constructor and method, or
   * if no midi device is opened.
   */
  loadUADSR(type, config) {

    if (config === undefined)
      config = this.uadsrConfig;
    
    if (this.uadsrConfig === undefined)
      throw (`ZynthoMIDI: cannot configure UADSR with undefined config.`);
      
    if (type == config.type && this._uadsr != null) {
      zconsole.notice('Skipping uadsr load as the type is the same.');
      return;
    }
    
    switch (type) {
      case "uadsr4" :
        this._uadsr = new UADSR4();
        this._uadsr.setBinds(config.uadsr4_binds);
      break;
      case "uadsr8" :
        this._uadsr = new UADSR8();
        this._uadsr.setBinds(config.uadsr8_binds);
      break;
      case "none" :
      
      break;
    }

    this.uadsrConfig.type = type;
    this.refreshFilterMap();
  }
  
 
 /**
  * triggers a midi learn event, as in, the next midi message will be
  * fired as a 'learn' message. This is triggered on all inputs. 
  * when a midi message is received, 'learn' is emitted.
  * @param filter (opt) a list of midi codes to be ignored.
  */
  midiLearn(filter) {
    if (filter !== undefined && !Array.isArray(filter)) {
      filter = [filter];
      //sanitize
      filter = filter.map ( e=> parseInt(e));
    }
    
    if (this.learnCallback === undefined) {
      this.learnCallback = (delta, msg) => {
        if (filter !== undefined) {
          if (filter.indexOf(msg[0] >> 4) == -1) {
            for (let input in this.midiConnections)
              this.midiConnections[input].once('message', this.learnCallback);
            
            return;
          }
        }
        
        this.emit('learn', msg);
        for (let input in this.midiConnections)
          this.midiConnections[input].off('message', this.learnCallback);
      }
    }
    
    for (let input in this.midiConnections) {
      this.midiConnections[input].once('message', this.learnCallback);
    }
  }
  
  /**
   * removes a bind file from the static filter map.
   * @param path full path to file
   * @return false if file is not present
   */
  removeBind(path) {
    let index = this.filterList.indexOf(path);
    if (index == -1) return false;
    this.filterList.splice(index,1);
    this.refreshFilterMap(true);
    zconsole.debug(`Removed bind ${path}`);
    return true;
  }
  
  loadSessionBind(path) {
    if (path != null)
      this.chainSession.addBindings('session', path);
    else
      this.chainSession.addBindings('session');
  }
  
  /**
   * Refresh the static filter map. A static bind map is composed of
   * default.json, the bind file for keyboard, and any custom performance
   * files that are not instrument binds.
   * This should be avoided for live perfomances as it is a bit time consuming,
   * each filter list must be reloaded.
   * Filter chain:
   * [default.json]>[static filters]>[midi filter]>[uadsr]>[instrument]>[session]
   * @param force (default=false) if true, reloads the default bindings 
   */
  refreshFilterMap(force = false) {
    var map = null;
    try {
      map = KNOT.FilterMap.merge(
        this.chainController.createFilterMap(),
        this.chainSession.createFilterMap()
      );
    } catch (err) {
      zconsole.error(`ZynthoMidi::refreshFilterMap: merge error. ${err}`);
    }
    
    try {
      if (this.knot.filterMap != null)
        delete this.knot.filterMap;
      
      if ( map != null && Object.keys(map).length > 0)
        this.knot.filterMap = map;
    } catch (err) {
      zconsole.error(`ZynthoMidi::refreshFilterMap: ${err}`);
    }
  }
  
 /**
   * Creates a new midi or deletes it for the selected keyboard.
   * If a new input is requested, the corresponding keyboard bind
   * is loaded.
   * @param devicePort either ALSA port name (x:y) or device name
   * @param status (default =true) if true, device is plugged in, and bind
   * loaded. Otherwise, it is discarded.
   * @throws if invalid device name/id
   */
  setConnection(devicePort, status) {
    status = (status === undefined) ? true : status;
    const inputs = this.enumerateInputs();
    let deviceID = -1;
    
    if (devicePort.match(/ \d+:\d+\s*$/))
      deviceID = inputs.map( (e)=>{return e.port;}).indexOf(devicePort);
    else {
      deviceID = inputs.map ( e => e.name).indexOf(devicePort);
      if (deviceID > -1)
        devicePort = inputs[deviceID].port;
    }
    
    if (deviceID < 0){
      throw `invalid device ${devicePort}.`;
    }
    
    if (this.midiConnections[devicePort] !== undefined) {
      if (status) return;
    
      //remove connection
      this.midiConnections[devicePort].closePort();
      this.midiConnections[devicePort] = undefined;
      delete this.midiConnections[devicePort];
      
      this.emit('device-out', inputs[deviceID].name);
      zconsole.log(`Released midi connection from ${devicePort}.`);
    } else {
      
      //create a new midi input
      let newInput = new MIDI.Input();
      newInput.on('message', (delta, msg) =>{
          this.knot.midiCallback(delta, msg);
      });
      
      //zconsole.notice(`Midi port stored as ${devicePort}`);
      this.midiConnections[devicePort] = newInput;
      
       try {
        newInput.openPort(deviceID);
      } catch (err) {
        throw `Midi: cannot connect to ${deviceID}`;
      }
      
      zconsole.log(`Connected to ${devicePort}.`);
      this.emit('device-in', inputs[deviceID].name);
    }
    
    /*
     * load/unload binds. If deviceName has unsupported characters, replace
     * bad character with lower line "_".
     *
    */  
    if (this.cartridgeDir != null) {
      let deviceName = devicePort.match(/[^:]+:(.*) \d+:\d+.*/)[1];
      let deviceBindFile = ZynthoIO.sanitizeString(deviceName),
          deviceBindPath = this.cartridgeDir+`/${deviceBindFile}.json`;
      
      if (!Fs.existsSync(deviceBindPath))
        deviceBindPath = null;
      
      try {
        if (status)
          this.chainController.addBindings(deviceName, deviceBindPath);
        else
          this.chainController.removeBindings(deviceName); 
      } catch (err) {
           zconsole.warning(`Something went wrong while managing bind: ${err}`);
      } finally {
        this.refreshFilterMap();
      }
    }
  }
  
  
  /**
   * saves a knot configuration
   */
   saveKnotConfiguration(chainObject) {
      if ( chainObject.file == null) {
        let path = ZynthoIO.sanitizeString(chainObject.id);
        chainObject.file = `${this.cartridgeDir}/${path}.json`;
      }
      
      try {
        Fs.writeFileSync(chainObject.file, 
          JSON.stringify(chainObject.bindings)
        );
        return true;
      } catch (err) {
        zconsole.error(`Error while saving Knot config: ${err}`);
        return false;
      }
   }
   
    /**
   * Check if all devices from the `plugged_device` config list is connected.
   * If not, tries to connect it.
   * This is also called from a timer on zyntho server
   */
  syncPluggedDevices() {
    if (this.midiInputDevices == null)
      return;
    
    const inputs = this.enumerateInputs();
    
    //Check out if any device supposed to be plugged is not plugged
    inputs.forEach( (inputObj) => {
     
      if ( !inputObj.connected  &&
        this.midiInputDevices.indexOf(inputObj.name) != -1 ){   
        zconsole.log(`Attemping start up connection to midi device ${inputObj.name}`);
        try {
          this.setConnection(inputObj.port, 1);
        } catch (err) {
          zconsole.error(`Failed to connect ${inputObj.name} : ${err}`);
        }
      }
    });
    
    /*
     * Check out any lost connection
     * NOTE: just turning off controller is NOT the expected behaviour.
     * This is just so any plug-replug of the device works as expected,
     * as undead midi connections will prevent re-plugging.
     * 'device-out' signal is NOT emitted.
     */
    let connectedPorts = Object.keys(this.midiConnections),
      currentPorts = inputs.map ( (obj) => obj.port);
    
    let lostConnections = 
      connectedPorts.filter( port => !currentPorts.includes(port) );
    
    //zconsole.log(`${JSON.stringify(currentPo)}`);
    
    lostConnections.forEach ( devicePort  => {
      zconsole.log(`Lost connection to ${devicePort}`);
      try {
          this.midiConnections[devicePort].closePort();
          this.midiConnections[devicePort] = undefined;
          delete this.midiConnections[devicePort];
          zconsole.log(`Removed connection ${devicePort}`);
        } catch (err) {
          zconsole.error(`Failed to delete connection ${devicePort} : ${err}`);
        }
    });
  }
}

exports.ZynthoMidi = ZynthoMidi;
