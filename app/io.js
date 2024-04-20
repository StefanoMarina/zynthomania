/*********************************************************************
 * Zynthomania IO functions
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

const Fs = require('fs');

var exports = module.exports = {};

/**
 * checks if a file exists
 */
exports.fileExists = async function(path) {
  if (path == null) return false;
  try { await Fs.access(path); return true;}
  catch {return false;}
}

/**
 * returns a list with all file names
 * @param path path to search
 * @param ignoreDir (default true) if true, exclude all directories
 * @param mode "path" (default) returns full path, "name" returns name only, 
 *             "obj" returns an array of objects {name:, path:}
 */
exports.listAllFiles = function (path, ignoreDir, mode) {
  
 if (undefined === ignoreDir) ignoreDir = true;
 mode = (undefined === mode) ? "path" : mode.toLowerCase();
 
 var files = (ignoreDir)
              ? Fs.readdirSync (path)
                .filter(function (file) {
                    return !Fs.statSync(path+'/'+file).isDirectory();
              })
              : Fs.readdirSync(path);
  
  if (mode == "path") return files;
  
  let regex = /[^/]+$/;
  let result = [];
  
  let name = "";
  let match = null;
  files.forEach(file => {
    match = regex.exec(file);
    name = (match != null) ? match[1] : file;
    
    result.push ( (mode == "name") 
            ? name
            : {"name": name, "path": path+'/'+file}
    );
  });
    
  return result;
}

module.exports.createIOConfig = function (config) {
  let IO = {};
  
  if (config.cartridge_dir !== undefined &&
        Fs.existsSync(config.cartridge_dir)
        && Fs.existsSync(config.cartridge_dir+'/config.json')) 
  {
      console.log('<6> Using cartridge.');
      IO.workingDir = config.cartridge_dir;
  } else if (Fs.existsSync(config.fallback_dir)
      && Fs.existsSync(config.fallback_dir+'/config.json')) {
      console.log('<6> Missing cartridge. Using fallback dir.');
      IO.workingDir = config.fallback_dir;
  } else {
    throw 'There is no valid directory or configuration available.';
  }
  
  try {
    Fs.accessSync(IO.workingDir+'/config.json', Fs.W_OK);
    IO.readOnlyMode = false;
  } catch (err) {
    console.log('<6> Access is read only.');
    IO.readOnlyMode = true;
  }
  
  return IO;
}

var zconsole = {};
module.exports.zconsole = zconsole;
/**
 * zconsole is a simple console wrapper for systemd messages
 * 2: [critical] - aborting stuff.
 * 3: [error] - errors
 * 4: [warning] - warnings
 * 5: [notice] unusual/important stuff
 * 6: [info] standard stuff
 * 7: [debugging] verbose level
 */

zconsole.logGet = function(req) {
  console.log(`<6> [GET] ${req.path}: ${JSON.stringify(req.query)}`);
}

zconsole.logPost = function(req) {
  console.log(`<6> [POST] ${req.path}: ${JSON.stringify(req.body)}`);
}

zconsole.debug = function(msg) {
  console.log(`<7> ${msg}`);
}

zconsole.log = function(msg) {
  console.log(`<6> ${msg}`);
}

zconsole.notice = function(msg) {
  console.log(`<5> ${msg}`);
}

zconsole.warning = function(msg) {
  console.log(`<4> ${msg}`);
}

zconsole.error = function(msg) {
  console.error(`<3> ${msg}`);
}

zconsole.critical = function(msg) {
  console.error(`<2> ${msg}`);
}

