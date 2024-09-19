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
module.exports = {};

const zconsole = require('./io.js').zconsole;

const OSCWorker = require('./oscworker.js').OSCWorker; //debug

module.exports.registerOSC = function (zynServer) {
  let emitter = zynServer.oscEmitter;
  
  
  /**
   * ZynthoMidi binds
   */
  emitter.on('/zmania/bind/load', function (zyn, args) {
    let midiService = zyn.midiService;
    if (midiService == null)
      return;
      
    midiService.addBind(midiService.cartridgeDir
                          +`/${args[0].value}`);
  });
  
  emitter.on('/zmania/bind/remove', function (zyn, args) {
    let midiService = zyn.midiService;
    if (midiService == null)
      return;
      
    midiService.removeBind(midiService.cartridgeDir
                          +`/${args[0].value}`);
  });
   
  emitter.on('/zmania/binds/dump', function (zyn) {
    if (zyn.midiService != null) {
      zconsole.log(JSON.stringify(zyn.midiService.knot.filterMap, null, 1));
    }
  });
  
  /**
   * Presets
   */
  emitter.on('/zmania/preset', (zyn, args) => {
    zyn.loadPreset(args[0].value,
     JSON.parse(args[1].value),
     args[2].value);
  });
  
  /*
   * IO calls
   */
   emitter.on('/zmania/load_xiz', function (zyn, args) {
     let arguments = args.map ( (arg) => arg.value);
     zyn.loadInstrument(arguments[0], arguments[1]);
   });
   
   emitter.on('/zmania/run_script', function (zyn, args) {
     zyn.runScript(args[0].value);
   });
   
   emitter.on('/zmania/load_xmz', function (zyn, args) {
     try {
       zyn.sessionLoad(args[0].value);
     } catch (err) {
       zconsole.error(`session load error: ${err}`);
     }
   });
   
   emitter.on('/zmania/save_xmz', function (zyn, args) {
     try {
       zyn.sessionSave(args[0].value);
     } catch (err) {
       zconsole.error(`session save error: ${err}`);
     }
   });
   
   /*
    * Special synth actions
    */
    
  //H725 - adsynth but not padsynth
  zynServer.parser.translate(
    '/zmania/part[0-15]/kit[0-15]/adpars/VoicePar[0-7]/OscilSmp/H725')
    .packets.map ( (packet) => packet.address )
    .forEach ( (addr) => emitter.on(addr, zynthomania_osc_h725));
  
  zynServer.parser.translate(
    '/zmania/part[0-15]/kit[0-15]/adpars/VoicePar[0-7]/OscilSmp/T800')
    .packets.map ( (packet) => packet.address )
    .forEach ( (addr) => emitter.on(addr, zynthomania_osc_T800));
  zynServer.parser.translate(
    '/zmania/part[0-15]/kit[0-15]/padpars/oscilgen/T800')
    .packets.map ( (packet) => packet.address )
    .forEach ( (addr) => emitter.on(addr, zynthomania_osc_T800));
  
  zynServer.parser.translate(
    '/zmania/part[0-15]/kit[0-15]/adpars/VoicePar[0-7]/OscilSmp/Robodevil')
    .packets.map ( (packet) => packet.address )
    .forEach ( (addr) => emitter.on(addr, zynthomania_osc_RoboDevil));
  zynServer.parser.translate(
    '/zmania/part[0-15]/kit[0-15]/padpars/oscilgen/Robodevil')
    .packets.map ( (packet) => packet.address )
    .forEach ( (addr) => emitter.on(addr, zynthomania_osc_RoboDevil));
}

/**
 * H725 function
 */
function zynthomania_osc_h725(zyn, args, address) {
  let realpath = address.substr(7, address.length-4-7-1); //-param -zmania -/
  zconsole.debug(`Real path : ${realpath}`);
  
  let paths = [`${realpath}/Prand`,
      `${realpath}/Pamprandtype`,
      `${realpath}/Pamprandpower`];
   
  if (args.length == 0) { //GET request
    zyn.oscPromise(paths, 1000)
    .then ( (result) => {
  
      let value = 0, randtype = result[paths[1]][0];
      
      if ( randtype > 0)
        value = result[paths[2]][0];
        
      zyn.emit(address,  [{ 'type': 'i', 'value' : value }]);
    });
  } else {
    
     let value = args[0].value;
     let scores = Array(3);
     let rand = 64 - value;
     
     if (value == 0)
        scores = [0,0,0];
     else
       scores = [rand, 1, value];
    
    let sends = [];
    for (let i = 0; i < 3; i++)
      sends.push(`${paths[i]} ${scores[i]}`);
    
    zyn.sendOSC(zyn.parser.translateLines(sends));
  }
}

function zynthomania_osc_T800(zyn, args, address) {
  let realpath = address.substr(7, address.length-4-7-1); //-param -zmania -/
  zconsole.debug(`Real path : ${realpath}`);
  
  let paths = [
      `${realpath}/Pbasefuncmodulationpar1`,
      `${realpath}/Pbasefuncmodulation`,
      `${realpath}/Pbasefuncmodulationpar3`
  ];
  
  if (args.length == 0) { //GET request
    zyn.oscPromise(paths, 1000).then ( (result)=>{
      let value = result[paths[1]][0];
      let type = result[paths[2]][0];
      
      if (type == 0)
        value = 0;
        
      zyn.emit(address,  [{ 'type': 'i', 'value' : value }]);
    });
  } else { //set
    let value = args[0].value;
    let half = Math.floor( (value+1)/2);
    if (value == 0)
      scores = [0,0,0];
    else if (value < 64)
      scores = [value,1,0];
    else if (value < 96)
      scores = [value,1,half];
    else
      scores = [value,2,half];
    
    let sends = [];
    for (let i = 0; i < 3; i++)
      sends.push(`${paths[i]} ${scores[i]}`);
    
    zyn.sendOSC(zyn.parser.translateLines(sends));
  }
}

function zynthomania_osc_RoboDevil(zyn, args, address) {
  let realpath = address.substr(7, address.length-'Robodevil'.length-7-1); //-param -zmania -/
  zconsole.debug(`Real path : ${realpath}`);
  
  let paths = [
      `${realpath}/Pmodulationpar1`,
      `${realpath}/Pmodulation`,
      `${realpath}/Pmodulationpar3`
  ];
  
  if (args.length == 0) { //GET request
    zyn.oscPromise(paths, 1000).then ( (result)=>{
      let value = result[paths[1]][0];
      let type = result[paths[2]][0];
      
      if (type == 0)
        value = 0;
        
      zyn.emit(address,  [{ 'type': 'i', 'value' : value }]);
    });
  } else { //set
    let value = args[0].value;
    let half = Math.floor( (value+1)/2);
    if (value == 0)
      scores = [0,0,0];
    else if (value < 64)
      scores = [value,1,0];
    else if (value < 96)
      scores = [value,2,half];
    else
      scores = [value,3,half];
    
    let sends = [];
    for (let i = 0; i < 3; i++)
      sends.push(`${paths[i]} ${scores[i]}`);
    
    zyn.sendOSC(zyn.parser.translateLines(sends));
  }
}
