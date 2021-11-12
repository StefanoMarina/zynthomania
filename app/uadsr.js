/***********************************************************************
(c) Copyright 2021 by Stefano Marina.

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject
to the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR
ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
**********************************************************************/

var exports = module.exports = {};

const Fs = require ('fs');
const KNOT = require( './knot/knot.js');

class UADSR4 {
  constructor() {
    
    this.mode = "amp";
    this.filters = {};
    
    this.coreBind = {
        "amp" : JSON.parse(Fs.readFileSync(`${__dirname}/../data/uadsr-amp.json`)),
        "filter" : JSON.parse(Fs.readFileSync(`${__dirname}/../data/uadsr-filter.json`)),
        "filter2" : JSON.parse(Fs.readFileSync(`${__dirname}/../data/uadsr-filter-val.json`)),
        "freq" : JSON.parse(Fs.readFileSync(`${__dirname}/../data/uadsr-freq.json`)),
        "freq2" : JSON.parse(Fs.readFileSync(`${__dirname}/../data/uadsr-freq-val.json`)),
    };
    
    this.switchBind = JSON.parse(Fs.readFileSync(`${__dirname}/../data/uadsr4.json`));
  }
  
  setBinds(bindArray) {
    let keys = Object.keys(this.coreBind);
    if (bindArray == null || bindArray.length < 5)
      throw `UADSR4: Invalid bind request ${JSON.stringify(bindArray)}`;
      
    keys.forEach (key => {
      for (let i = 0; i < 4; i++)
        this.coreBind[key]['all'][i]['cc'] = bindArray[i];
        
      this.filters[key] = null;
    });
    
    let switcher = bindArray[4];
    
    if ( switcher != this.switchBind['all'][0]['cc']
            || this.filters['switcher'] == null) {
      this.switchBind['all'][0]['cc'] = switcher;
      this.filters['switcher'] = new KNOT.FilterMap(this.switchBind, true);
    }
  }
  
  getFilterMap(mode) {
    mode = mode.toLowerCase();
    if (!mode.match(/(amp|filter2?|freq2?)/))
      throw `UADSR4: unrecognized mode ${mode}`;
      
    if (this.filters[mode] == null) {
      let filtered = new KNOT.FilterMap(this.coreBind[mode]);
      console.log(`UADSR4: New filter map: ${mode}`);
        this.filters[mode] = KNOT.FilterMap.merge(
        filtered, this.filters['switcher']);
    }
    
    return this.filters[mode];
  }
  
  getBinds() {
    return [
      this.coreBind.amp.all[0].cc,
      this.coreBind.amp.all[1].cc,
      this.coreBind.amp.all[2].cc,
      this.coreBind.amp.all[3].cc,
      this.switchBind.all[0].cc
    ];
  }
  
  getType() {return "uads4"};
}

class UADSR8 {
  constructor() {
    
    this.coreBind = JSON.parse(Fs.readFileSync(`${__dirname}/../data/uadsr8.json`));
  }
  
  setBinds(bindArray) {
    for (let i = 0; i < 8; i++)
      this.coreBind['all'][i]["cc"] = bindArray[i];
    
    this.filterMap = new KNOT.FilterMap(this.coreBind, true);
  }
  
  getFilterMap(mode) {
    return this.filterMap;
  }
  
  getBinds() {
    let result = [];
    for (let i = 0; i < 8; i++)
      result.push(this.coreBind.all[i].cc);
    
    return result;
  }
  
  getType() {return "uadsr8"}
}

exports.UADSR4 = UADSR4;
exports.UADSR8 = UADSR8;
