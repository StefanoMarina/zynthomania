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

const OSCParser = require ('./parser.js')

const EventEmitter = require('events');

const {execSync, exec} = require("child_process");

const KNOT = require('./knot/knot.js');

const MIDI = require('midi');

const Cartridge = require('./cartridge.js');

const Fs = require('fs');

const KnotFilters = require('./knot/filter.js');

var exports = module.exports = {};

exports.ZynthoMidi = class {
  
  constructor(osc_server, cartridge_dir) {
    this.midiInputs = {};
    this.midiOutput = null;
    this.knot = new KNOT.Knot(osc_server);
    this.filterList = [];
    this.baseFilterMap = null;
    this.instrumentMap = null;
    
    this.cartridgeDir = cartridge_dir + "/binds";
    
    if (Fs.existsSync(this.cartridgeDir + "/default.json")) {
      this.filterList[0] = this.cartridgeDir + "/default.json";
      this.basefilterMap = new KnotFilters.FilterMap(this.filterList[0]);
    }
  }
  
  getMidiOutput(){
    if (this.midiOutput == null)
      this.midiOutput = new MIDI.Output();
    
    return this.midiOutput;
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
    if (midi.isPortOpen()) {
      if (!force) return;
      midi.closePort();
    } else {
      midi.openVirtualPort('Zynthomania');
      exec("aconnect 'RtMidi Output Client:Zynthomania' 'ZynAddSubFX'");
      this.knot.setMidiOut(midi);
    }
  }
  
  /**
   * Creates a new midi or deletes it for the selected keyboard.
   * If a new input is requested, the corresponding keyboard bind
   * is loaded.
   * @param devicePort midi device port (as in enumerateInputs().port)
   * @param status (default =true) if true, device is plugged in, and bind
   * loaded. Otherwise, it is discarded.
   * @throws if invalid device name/id
   */
  setConnection(devicePort, status) {
    status = (status === undefined) ? true : status;
     
    if (this.midiInputs[devicePort] !== undefined) {
      if (status) return;
    
      //remove connection
      this.midiInputs[devicePort].closePort();
      this.midiInputs[devicePort] = undefined;
      delete this.midiInputs[devicePort];
      
      console.log(`<6> Released midi connection from ${devicePort}.`);
      return;
    } 
    
    //create new connection
    let deviceID = this.enumerateInputs().map( (e)=>{return e.port;})
          .indexOf(devicePort);
    if (deviceID < 0)
      throw "Midi: invalid device";
    
    let newInput = new MIDI.Input();
    newInput.on('message', (delta, msg) =>{
        this.knot.midiCallback(delta, msg);
    });
    
    this.midiInputs[devicePort] = newInput;
    
    if (this.cartridgeDir != null) {
      //load binds. If deviceName has unsupported characters, replace
      //bad character with lower line "_".
      
      let deviceName = devicePort.match(/[^:]+:(.*) \d+:\d+.*/)[1];
      let deviceBindFile = deviceName.replace(/[<>:;,?"*|/]+$/g,"_"),
          deviceBindPath = this.cartridgeDir+`/${deviceBindFile}.json`;
      
      console.log(deviceBindPath);
      
      if (Fs.existsSync(deviceBindPath)){
        console.log("<6> Found bind file for device.");
        
        try {
          this.filterList[1] = deviceBindPath;
          this.refreshFilterMap(true);
        } catch (err) {
          console.log(`<3> Something went wrong while loading bind: ${err}`);
        }
      }
    }
    
    try {
      newInput.openPort(deviceID);
    } catch (err) {
      throw `<3> Midi: cannot connect to ${deviceID}`;
    }
    
    console.log(`<6> Midi: Connected to ${devicePort}.`);
  }
  
  /**
   * Refresh the static filter map. A static bind map is composed of
   * default.json, the bind file for keyboard, and any custom performance
   * files that are not instrument binds.
   * This should be avoided for live perfomances as it is a bit time consuming,
   * each filter list must be reloaded.
   * @param force (default=false) if true, reloads the default bindings 
   */
  refreshFilterMap(force) {
    force =  (force === undefined) ? false : force;
    
    let list = this.filterList.filter((item) => {return item != null});
    
    if (force) {
      this.baseFilterMap = null;
      let map;
      for (let i = 0; i < list.length; i++){
        
        map  = new KnotFilters.FilterMap(JSON.parse(Fs.readFileSync(list[i])));
        
        this.baseFilterMap = (this.baseFilterMap == null)
          ? map
          : KnotFilters.FilterMap.merge(this.baseFilterMap, map);
      }
    }
    
    if (this.instrumentMap != null) {
      this.knot.filterMap = KnotFilters.FilterMap.merge(this.baseFilterMap,this.instrumentMap);
    } else {
      this.knot.filterMap = this.baseFilterMap;
    }
    
    console.log(`Final filter map : ${JSON.stringify(this.knot.filterMap,null,2)}`);
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
      console.log(`Loading instrument bind ${bindFile}`);
      try {
        this.instrumentMap = new KnotFilters.FilterMap(JSON.parse(
          Fs.readFileSync(bindFile) ));
      } catch (err) {
        this.instrumentMap = null;
        console.log(`<3> ZynthoMidi: failed loading bindings ${bindFile}:${err}`);
      }
    }
    
    this.refreshFilterMap(false);
  }
}
