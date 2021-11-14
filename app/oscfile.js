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

const FS = require ('fs');
const KNOT = require ('./knot/knot.js');

function _onFileRead(data, loadCallback) {
    const lines = data.toString().replace(/\r\n/g,'\n').split('\n');
    const parser = new KNOT.OSCParser();
    
    let packets = null;
    let osc = null;
    let error = null;
    
    for (let line of lines) {
      error = null;
      line = line.trimLeft().trimRight();
      if (line == "")
        continue;
      
      if (line.match(/^ *\[/)) {
        packets = [];
        continue;
      } else if (line.match(/^ *\]/)) {
        if (packets == null)
          error = "OSCFile: closed packet but no packet opened.";
        else {
          try {
            osc = parser.translateLines(packets);
          } catch (err) {
            osc = null;
            error = `OSCFile: could not translate packet ${JSON.stringify(packets)} : ${err}`;
          } finally {
            packets = null;
          }
        }        
      } else if (packets != null) {
        packets.push(line);
        continue;
      } else {
        try {
          osc = parser.translate(line);
        } catch (err) {
          osc = null;
          error = `OSCFile: could not translate ${line} : ${err}`;
        }
      }
      
      loadCallback(error, osc);
    }
  }

module.exports = {};

module.exports.load = function (file, loadCallback) {
    FS.readFile(file, 'utf8', (err, data) =>{
      if (err)
        throw `Could not read ${file} : ${err}`;
      else
        _onFileRead(data, loadCallback);
    });
  }
  
module.exports.loadSync = function (file, loadCallback) {
    let data = null;
    try {
      data = FS.readFileSync(file, 'utf8');
    } catch (err) {
      throw `Could not read ${file} : ${err}`;
    }
    
    _onFileRead(data, loadCallback);
}

