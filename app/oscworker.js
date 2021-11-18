/*********************************************************************
 * OSC message event worker
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

const EventEmitter = require('events');

/**
 * OSCWorker creates a promise upon multiple osc requests.
 * It is an eventemitter on its own. when all OSC requests are fulfilled,
 * the promise created with listen() will be triggered.
 */
class OSCWorker extends EventEmitter {
  
  constructor(emitter) {
    super();
    this.stack = [];
    this.outcome = {};
    this.emitter = emitter;
  }
  
  /**
   * adds an osc address to the stack. the address is bound through
   * .once() on the emitter, and it is then popped out from the osc stack.
   * When the stack gets empty, a 'done' message is sent internally to free
   * listen().
   */
  push(address, callback) {
    this.stack.push(address);
    this.emitter.once(address, (packet) => {
      if (undefined !== packet.args)
        this.outcome[address] = callback(address, packet.args);
      else
        this.outcome[address] = callback(address, packet);
        
      this.stack.splice(this.stack.indexOf(address),1);
      
      if (this.stack.length==0)
        this.emit('done', this.outcome);
    });
  }
  
  /**
   * creates a promise bound on the 'done' internal event
   * @returns a Promise that will be triggered when the last osc call
   * is made
   * @throws if called with an empty stack
   */
  listen() {
    return new Promise( (resolve) => {
      if (this.stack.length==0)
        resolve();
      else
        this.once('done', resolve);
    });
  }
}

module.exports.OSCWorker = OSCWorker;
