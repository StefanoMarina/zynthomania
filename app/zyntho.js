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

class OSCPathEvent extends EventEmitter {}

exports.ZynthoServer = class {
  constructor() {
    
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
    this.oscEvent = new OSCPathEvent();
  }
  
  /**
   * ZynthoServer::open
   * open preferences file and OSC connection
   */
  open(preferencesFile) {
    
    try {
      let data = Fs.readFileSync('preferences.json', 'utf-8');
      this.preferences = JSON.parse(data);
      
    } catch (err) {
      console.log(`Could not read Preferences.json : ${err}`);
      this.preferences = { "user": "pi", "synth": { "port" : "7777" }, "custom_dir": "/home/pi/custom", "bank_dir": "/usr/local/share/zynaddsubfx/banks/" }
    }

    this.osc = new Osc.UDPPort({
      localAddress: "127.0.0.1",
      localPort: 6666,

      remoteAddress: "127.0.0.1",
      remotePort: preferences.synth.port,
      metadata: true
    });
    
    this.osc.on('ready', () => {
        console.log ("Opened OSC Server");
    })
    
    var _this = this;
    this.osc.on("osc", function (oscMsg) {
        console.log("OSC message: ", oscMsg);
        _this.oscEvent.emit(oscMsg.address, oscMsg.args);
    });

    this.oscEvent.on("error", (err) => {
      console.log(`SORRY! ${err}`);
    });

    osc.open();
  }
  
}

exports.typeToString = function(type) {
  switch (type) {
     case 0: return 'None'; break;
     case 1: return 'Reverb'; break;
     case 2: return 'Echo'; break;
     case 3: return 'Chorus'; break;
     case 4: return 'Phaser'; break;
     case 5: return 'AlienWah'; break;
     case 6: return 'Distortion'; break;
     case 7: return 'EQ'; break;
     case 8: return 'DynamicFilter'; break;
     default: return `Unk (${type})`; break;
  }
}

export.nameToType = function(name) {
    case 'None': return 0;
    case 'Reverb': return 1;
    case 'Echo': return 2;
    case 'Chorus': return 3;
    case 'Phaser': return 4;
    case 'AlienWah': return 5;
    case 'Distortion': return 6;
    case 'EQ': return 7;
    case 'DynamicFilter': return 8;
    default: return -1;
}
