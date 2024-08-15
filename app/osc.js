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
        zconsole.warning(`/zmania/uadsr4/bind: ${err}`);
      }
    }
  });
  
  emitter.on('/zmania/uadsr8/bind', function (zyn, args) {
    let values = args.map(arg => arg.value);
    if (zyn.midiService != null) {
      try {
      zyn.midiService.getUADSR().setBinds(values);
      zyn.midiService.refreshFilterMap();
      zyn.config.uadsr['uadsr8_binds'] = 
          zyn.midiService.uadsrConfig['uadsr8_binds'] = values;
      zyn.save();
      } catch (err) {
        zconsole.error(`/zmania/uadsr8/bind:${err}`);
      }
    }
  });
  
  emitter.on('/zmania/binds/dump', function (zyn) {
    if (zyn.midiService != null) {
      zconsole.log(JSON.stringify(zyn.midiService.knot.filterMap, null, 1));
    }
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
   
   emitter.on('/zmania/subgenerator/path', function (zyn, args) {
     if (args.length == 0) {
       zyn.emit('/zmania/subgenerator/path', 
        zyn.parser.translate(
        `/zmania/subgenerator/path '${zyn.ssHarmonics.path}'`)
        );
     } else {
       zyn.ssHarmonics.path = args[0].value;
     }
   });
   
   emitter.on('/zmania/test', function (zyn, args) {
     let test = zyn.parser.translate('/zmania/test1');
     const worker = new OSCWorker(zyn);
     worker.pushPacket(test, ()=> {
       zconsole.debug('listened to test packet');
      });
     zyn.emit('osc',test);
     Promise.resolve(worker.listen());
   });
   
   emitter.on('/zmania/subsynth/offset',  (zyn, args)=>{
     if (args.length == 0) {
       let newPacket = zyn.parser.translate(
       '/zmania/subsynth/offset '
       + zyn.ssHarmonics.data.offset);
       
       zyn.osc.emit('osc', newPacket);
     } else {
       zconsole.debug("offset SET");
      try {
        let val = parseInt(args[0].value);
        zyn.ssHarmonics.offset = Math.max(1, Math.min(
          32, val));
      } catch {
        throw '/zmania/subsynth/offset: invalid number';
       } 
     }
   });
}

/* Subsynth: set bandwidth alg */
function osc_subsynth_manager_get_alg(zyn, args) {
  
}
