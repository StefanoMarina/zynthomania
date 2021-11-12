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

module.exports.registerOSC = function (zynServer) {
  let emitter = zynServer.oscEmitter;
  
  
  /**
   * ZynthoMidi binds
   */
  emitter.on('/zmania/bind/load', function (zyn, args) {
    console.log("called zmania/bind/load");
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
  
  emitter.on('/zmania/uadsr/type',  function (zyn, args) {
    if (zyn.midiService != null)
      zyn.midiService.loadUADSR(args[0].value);
      zyn.save();
  });
  
  emitter.on('/zmania/uadsr4/mode', function (zyn, args) {
    if (zyn.midiService != null) {
      zyn.midiService.uadsrConfig.mode = args[0].value;
      zyn.midiService.refreshFilterMap(false);
      //NOTE: do not save mode change, since save is blocking and mode could
      //change a lot due to osc calls.
    }
  });
  
  emitter.on('/zmania/uadsr4/bind', function (zyn, args) {
    let values = args.map(arg => arg.value);
    
    if (zyn.midiService != null) {
      try {
        zyn.midiService.getUADSR().setBinds(values);
        zyn.midiService.refreshFilterMap();
        zyn.config.uadsr['uadsr4_binds'] = 
          zyn.midiService.uadsrConfig['uadsr4_binds'] = values;
        zyn.save();
      } catch (err) {
        console.log(`<4> /zmania/uadsr4/bind: ${err}`);
      }
    }
  });
  
  emitter.on('/zmania/uadsr8/bind', function (zyn, args) {
    let values = args.map(arg => arg.value);
    if (zyn.midiService != null) {
      try {
      zyn.midiService.getUADSR().setBinds(values);
      zyn.midiService.refreshFilterMap();
      zyn.config.uadsr['uadsr4_binds'] = 
          zyn.midiService.uadsrConfig['uadsr4_binds'] = values;
      zyn.save();
      } catch (err) {
        console.log(`<4> /zmania/uadsr8/bind:${err}`);
      }
    }
  });
  
  emitter.on('/zmania/binds/dump', function (zyn) {
    if (zyn.midiService != null) {
      console.log(JSON.stringify(zyn.midiService.knot.filterMap, null, 1));
      if (zyn.midiService._uadsr != null)
        console.log(JSON.stringify(
          zyn.midiService._uadsr.filters[zyn.config.uadsr.mode]));
    }
  });
}

