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
}
