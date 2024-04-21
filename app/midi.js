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

class ZynthoMidi extends EventEmitter {
  
  constructor(IODir, config) {
    super();
    this.midiInputs = {};
    this.midiOutput = null;
    this.knot = new KNOT.Knot(null);
    this.knot.setEmitOnly(true);
    this.filterList = [];
    this.baseFilterMap = null;
    
    //Midi instrument map. still single map
    this.instrumentMap = null;
    
    //Session map. this is the currently edited session.
    this.sessionMap = null;
    
    //Session config. this is the currently edited session.
    this.sessionConfig = null;
    
    this.cartridgeDir = IODir + "/binds";
    
    if (Fs.existsSync(this.cartridgeDir + "/default.json")) {
      this.filterList.push(this.cartridgeDir + "/default.json");
      this.basefilterMap = new KNOT.FilterMap(this.filterList[0]);
    }
    
    this.oscParser = new KNOT.OSCParser();
    this.uadsrConfig = config.uadsr;
    this.midiInputDevices = config.plugged_devices;
    
    //console.log (`ZMIDI: build ${JSON.stringify(this.uadsrConfig)}`); 
  }
  
   /**
   * adds a bind file and refresh current configuration.
   * @param path full path to .json file.
   * @return false if file does not exist or is already present in the queue.
   */
  addBind(path) {
    if (!Fs.existsSync(path) || this.filterList.indexOf(path)>=0){
      zconsole.notice(`addBind: missing file or file already present ${path}`);
      return false;
    }
    
    this.filterList.push(path);
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
      if (this.midiInputDevices != null) {
        const inputs = this.enumerateInputs(); 
        let mapName = inputs.map (obj => obj.name);
        let index = -1;
        
        this.midiInputDevices.forEach( (req) => {
          zconsole.log(`Attemping start up connection to midi device ${req}`);
          index = mapName.indexOf(req);
          if (index != -1) {
            try {
              this.setConnection(req, 1);
            } catch (err) {
              zconsole.notice(`Failed to connect ${req} : ${err}`);
            }
          }
        });
      }
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
    let midi = new MIDI.Input();
    let q = midi.getPortCount();
    var result = [];
    let connectedInputs = Object.keys(this.midiInputs);
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
    if (filter !== undefined && !Array.isArray(filter))
      filter = [filter];
    
    //sanitize
    filter = filter.map ( e=> parseInt(e));
    
    if (this.learnCallback === undefined) {
      this.learnCallback = (delta, msg) => {
        if (filter !== undefined) {
          if (filter.indexOf(msg[0] >> 4) == -1) {
            for (let input in this.midiInputs)
              this.midiInputs[input].once('message', this.learnCallback);
            
            return;
          }
        }
        
        this.emit('learn', msg);
        for (let input in this.midiInputs)
          this.midiInputs[input].off('message', this.learnCallback);
      }
    }
    
    for (let input in this.midiInputs) {
      this.midiInputs[input].once('message', this.learnCallback);
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
  refreshFilterMap(force) {
    force = (force === undefined) ? false : force;
    
    let list = this.filterList.filter((item) => {return item != null});
    
    //default, keyboard and static binds are flushed only on request
    if (force) {
      this.baseFilterMap = null;
      let map;
      for (let i = 0; i < list.length; i++){
        
        map  = new KNOT.FilterMap(JSON.parse(Fs.readFileSync(list[i])));
        
        this.baseFilterMap = (this.baseFilterMap == null)
          ? map
          : KNOT.FilterMap.merge(this.baseFilterMap, map);
      }
    }
    
    let map = this.baseFilterMap;
    let mapMerge = [];
    
    if (this._uadsr != null && this.uadsrConfig.type != "none")
      mapMerge.push(this._uadsr.getFilterMap(this.uadsrConfig.mode));
    if (this.instrumentMap != null)
      mapMerge.push(this.instrumentMap);
    
    if (this.sessionMap != null) {
      mapMerge.push(this.sessionMap);
    } else if (this.sessionConfig != null) {
      try {
        this.sessionMap = new KNOT.FilterMap(this.sessionConfig, false)
        mapMerge.push(this.sessionMap);
      } catch (err) {
        zconsole.error(`Invalid session filter map : ${err}`);
      }
    }
    
    mapMerge.forEach( (fmap) => {
      map =  ( map == null) ? fmap : KNOT.FilterMap.merge(map, fmap);
    });
    
    if (map != null)
      this.knot.filterMap = map;
    
   // console.log(`Final filter map : ${JSON.stringify(this.knot.filterMap,null,2)}`);
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
    
    if (deviceID < 0)
      throw `invalid device ${devicePort}`;
    
    if (this.midiInputs[devicePort] !== undefined) {
      if (status) return;
    
      //remove connection
      this.midiInputs[devicePort].closePort();
      this.midiInputs[devicePort] = undefined;
      delete this.midiInputs[devicePort];
      
      this.emit('device-out', inputs[deviceID].name);
      zconsole.log(`Released midi connection from ${devicePort}.`);
    } else {
      
      //create a new midi input
      let newInput = new MIDI.Input();
      newInput.on('message', (delta, msg) =>{
          this.knot.midiCallback(delta, msg);
      });
      
      this.midiInputs[devicePort] = newInput;
      
       try {
        newInput.openPort(deviceID);
      } catch (err) {
        throw `Midi: cannot connect to ${deviceID}`;
      }
      
      zconsole.log(`Connected to ${devicePort}.`);
      this.emit('device-in', inputs[deviceID].name);
    }
    
    if (this.cartridgeDir != null) {
      //load/unload binds. If deviceName has unsupported characters, replace
      //bad character with lower line "_".
      
      let deviceName = devicePort.match(/[^:]+:(.*) \d+:\d+.*/)[1];
      let deviceBindFile = deviceName.replace(/[<>:;,?"*|/]+$/g,"_"),
          deviceBindPath = this.cartridgeDir+`/${deviceBindFile}.json`;
      
      try {
        if (status)
          this.addBind(deviceBindPath);
        else
          this.removeBind(deviceBindPath);
      } catch (err) {
           zconsole.warning(`Something went wrong while managing bind: ${err}`);
      }
    }
  }
  
}

exports.ZynthoMidi = ZynthoMidi;
