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

const ALGS = ['SINE','COS', 'UP','DOWN', 'FLAT', 'RANDOM'];

function convertToCC( value, min, max ) {
  return Math.round ( ( value-min ) / (max-min) * 127 );
}


class SubsynthHarmonics {
  constructor(data) {
    if (data === undefined) {
      this.data = {
          'alg' : 'FLAT',
          'power' : 1,
          'offset' : 0
      };
    } else 
      this.data = data;
      
    if (!isNaN(this.data.alg))
      this.data.alg = ALGS[this.data.alg];
  }
  
  perform(path, alg) {
    if (alg !== undefined)
      this.data.alg = ALGS[alg];
    
    let values = null;
    
    switch (this.data.alg) {
      case 'SINE': values = this.alg_sine(this.data); break;
      case 'COS': values = this.alg_cos(this.data); break;
      case 'UP': values = this.alg_rampup(this.data); break;
      case 'DOWN': values = this.alg_rampdown(this.data); break;
      case 'FLAT': values = this.alg_flat(this.data); break;
      case 'RANDOM': values = this.alg_random(this.data); break;
    }
    
    for (let i = 0; i < values.length; i++)
      values[i] = `${path}${i+this.data.offset} ${values[i]}`;
    
    return values;
  }
  
  
  alg_sine(data) {
    let res = Array(32-data.offset);
  
    for (let i = 0; i < res.length; i++)
      res[i] = convertToCC( Math.sin(i*data.power), -1, 1);
    
    return res;
  }
  
   alg_cos(data) {
    let res = Array(32-data.offset);
  
    for (let i = 0; i < res.length; i++)
      res[i] = convertToCC( Math.cos(i*data.power), -1, 1);
    
    return res;
  }
  
  alg_rampup(data) {
    let res = Array(32-data.offset);
    
    for (let i = 0; i < res.length; i++)
      res[i] = convertToCC( Math.log( (i+1)*data.power), -1, 1);
    
    return res;
  }
  
  alg_rampdown(data) {
    let res = Array(32-data.offset);
    
    for (let i = 0; i < res.length; i++)
      res[i] = 127 - convertToCC( Math.log( (i+1)*data.power), -1, 1);
    
    return res;
  }
  
  alg_flat(data) {
    let res = Array(32-data.offset);
    let val = Math.round(data.power * 127);
    
    for (let i = 0; i < res.length; i++)
      res[i] = val;
    return res;
  }
  
  alg_random(data) {
    let res = Array(32-data.offset);
    let val = data.power * 64;
    
    for (let i = 0; i < res.length; i++)
      res[i] = Math.round(Math.random()*val);
    
    return res;
  }
  
  
}

exports.SubsynthHarmonics = SubsynthHarmonics;
