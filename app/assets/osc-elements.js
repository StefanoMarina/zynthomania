/*********************************************************************
 * Zynthomania
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


// Range is 30-330
/*const KNOB_OFFSET = 30;
const KNOB_RANGE = 300;
*/

//turns any generic /part into current part
function osc_sanitize(path) {
  let voice_translate = (window.zsession.voiceID == 127)
    ? 'GlobalPar' : `VoicePar${window.zsession.voiceID}`;
    
  return  path
          .replace('osccursor/', `${window.zsession.osccursor}/`)
          .replace('synthcursor/', `${window.zsession.synthcursor}/`)
          .replace('part/', `part${window.zsession.partID}/`)
          .replace('/fxcursor', window.zsession.fxcursor)
          .replace('kit/', `kit${window.zsession.layerID}/`)
          .replace('#synth#', window.zsession.synthID)
          .replace('synth/', window.zsession.synthname+'/')
          .replace('voice/', `${voice_translate}/`);
}

//Reduce a sync result data object to its last parameters, removing
//unnecessary arrays.
function osc_map_to_control(data) {
  res = {};
  for (let [key,value] of Object.entries(data)) {
    let reskey = /\/([\w\d ]+)$/.exec(key)[1];
    res[reskey] = (value.length == 1) ? value[0] : value;
  }
  return res;
}

function osc_script_to_single_value(data) {
  if (typeof data !== 'object') {
    return data;
  }
  
  let keys = Object.keys(data);
  if (keys.length == 1)
    return data[keys[0]][0];
  else
    return data;
}


/*
 * This will grab all OSC elements, create a unique request send and
 * updates all at once
 */
function osc_synch_section(section,force=false) {
  
  var allElements = Array.from(
    section.querySelectorAll('.osc-element')
  ). filter ( (el) => (force)
      ? el 
      : (el.dataset.oscPath !== undefined
        && !el.classList.contains('osc-button'))
  ).map ( el => el.id);
  
  if (allElements.length == 0) {
    console.log('osc_synch_section: empty request');
    return Promise.resolve(0);
  }
  
  return osc_synch(...allElements);
}

function osc_synch(...elements) {
  let objects = Array.from(arguments).map ( (id) => zsession.oscElements[id] )
      .filter( element => element != undefined && element.isEnabled() && 
      (element.oscpath != "" && element.oscpath != null) );
  
  if (objects.length == 0) {
    console.log(`osc_synch: empty request despite original length ${elements.length}`);
    return Promise.resolve(0);
  }
  
  let oscDictionary = new Map(
    objects.map ( obj => [obj.getAbsolutePath(), obj.HTMLElement.id] )
  );
  
  let oscPaths = Array.from(oscDictionary.keys());
  
  return new ZynthoREST().post('script', 
    {
      'requestResult' : 1,
      'script' : oscPaths
    })
    .then( (result) => {
        let packets = {};
        
        for (path in result) {
          let id = oscDictionary.get(path);
          let oscObject = window.zsession.oscElements[id];
          oscObject.setValue(result[path][0],true);
          /**
           * BUG
           * Events are triggered by 2D arrays:
           * { "path" : value[0] }
           * this returns a 1D array
           */
          oscObject.HTMLElement.dispatchEvent(
            new CustomEvent('sync', {'detail' :
                { [`${path}`]:  result[path]}
            }));
        }
    })
    .catch ( (msg) => {
      displayOutcome('Synch error!', true);
    });
}


/**
 * OSC channel
 * allows basic synching with server
 */
class OSCChannel {
  constructor(oscpath, range, serverRange) {
    this.oscpath = oscpath;
    this.range = (range == undefined) ? CC_RANGE : range;
    this.serverRange = (serverRange == undefined) 
      ? this.range : serverRange;
  }
  
  //Returns a sanitized path
  getAbsolutePath() {
    if (Array.isArray(this.oscpath)) {
      return this.oscpath.map( (el) => osc_sanitize(el) );
    }
    else
      return osc_sanitize(this.oscpath);
  }
  
  /**
   * Sends a request for value
   * @return a promise
   */
  sync() {
    this.displayScript();
    let script = this.getAbsolutePath();
    if (
      (Array.isArray(script) && script.length == 0)
      || script == '') {
        throw 'OSC::sync: empty script';
    }
    
    return new ZynthoREST().post('script', {
      script : this.getAbsolutePath(),
      'requestResult' : 1
    });
  }
  
  /**
   * act
   * sends parameters
   * @params params parameters array or string
   * @id (optional) index of a specific path of the script
   * @returns a promise
   */
   act (params, id) {
    this.displayScript();
    let script = this.getAbsolutePath();
    
    if (params != undefined) {
      if (Array.isArray(script)) {
        for (let i=0; i<script.length;i++)
          script[i] += (params[i] != "") 
            ? (' ' + params[i])
            : '';
      } else {
        script += ' ' + params;
      }
    }    
    if (id !== undefined) {
      if (id < 0 || id > script.length)
        throw `OSCElement::act: id ${id} out of range ${script.length}`;
      else
        script = [script[id]];
    }
    
    
    return new ZynthoREST().post('script', { 'script': script })
    . then ( ()=>{return script});
  }
  
  /*
   * Outputs the script to the main display
   */
  displayScript() {
    let script = this.getAbsolutePath();
    setLastOSC(script, this.serverRange);
    /*if (Array.isArray())
      document.getElementById('osc-message').innerHTML = 'Multiple OSC';
    else
      document.getElementById('osc-message').innerHTML = this.oscpath;*/
  }
}

//OSC Bundle will trigger sync/act events unrelated to html elements
//this cannot be called by osc_synch BTW
class OSCBundle extends OSCChannel {
  constructor(path, translator) {
    super(path, translator);
    this.syncEventCallbacks = [];
    this.actEventCallbacks = [];
  }
  
  sync() {
    return super.sync().then ( (data) => {
      if (this.syncEventCallbacks.length>0)
        this.syncEventCallbacks.forEach ( (cb)=> cb(data) );
      return data;
    });
  }
  
  act(params, bundleID) {
    return super.act(params, bundleID).then ( (data) => {
      if (this.syncEventCallbacks.length>0)
        this.actEventCallbacks.forEach ( (cb)=> cb(data) );
      return data;
    });
  }
  
  addEventListener(type, cb) {
    type = type.toLowerCase();
    if (type == 'sync')
      this.syncEventCallbacks.push(cb);
    if (type == 'act')
      this.actEventCallbacks.push(cb);
  }
}

/*
 * Basic OSC element interface
 * Supposed architecture:
 * .sync / .act > interaction with server
 * .setValue > set the GRAPHICAL value
 * Interaction with server Always force graphic update
 * Client updates do not force server interaction
 * so, to change a value: server > graphic update
 * client only update is used with mass requests (osc_synch_section)
 */

class OSCElement extends OSCChannel{
  constructor(clickableObject, bind = undefined, range = undefined) {
    super(
      ((clickableObject.dataset.oscPath)
        ? clickableObject.dataset.oscPath
        : ''),
      range
    );
    
    //Register element
    if (window.zsession.oscElements[clickableObject.id]) {
      console.log(`Error! ${clickableObject.id} already registered.`);
      return;
    } else {
      window.zsession.oscElements[clickableObject.id] = this;
    }
    
    this.HTMLElement = clickableObject;
    this.bind = bind;
    this.range = (range === undefined) 
        ? CC_RANGE
        : range;
    this.serverRange = this.range;
    
    this.oscpath = (clickableObject !== null 
      && clickableObject.dataset.oscPath)
      ? clickableObject.dataset.oscPath
      : "";

    if ( this.oscpath.indexOf(';')>-1)
      this.oscpath = this.oscpath.split[';'];
    
    //set predefined label
    if (clickableObject.dataset.label !== undefined){
      let lb = clickableObject.dataset.label.split(';');
      if (lb.length > 1)
        this.setLabel(lb[0], lb[1]);
      else
        this.setLabel(lb[0]);
    }
  }
  
  //Set what constitutes the control itself inside the content div
  setContent(html) {
    let content = this.HTMLElement.querySelector('.content');
    if (content == null) {
       content = document.createElement('div');
       content.classList.add('content');
       this.HTMLElement.append(content);
    }
    if ( typeof html === "string")
      content.innerHTML = html;
    else
      content.append(html);
    
    return content;
  }
  
  //set responsive label
  setLabel(long, short) {
    let header = this.HTMLElement.querySelector("header:first-child");
    if (header == null) {
      header = document.createElement("header");
      header.classList.add("header");
      this.HTMLElement.insertBefore(header, this.HTMLElement.firstChild);
    }
  
    this.label = long;
    if (short !== undefined) {
      header.innerHTML = 
         `<span class='d-none d-md-inline'>${long}</span>`
         +  `<span class='d-md-none'>${short}</span>`;
    } else
      header.innerHTML = long;
          
  }
  
 setRange(range, serverRange) {
   this.range = range;
   if (serverRange == undefined)
    this.serverRange = range;
   else
    this.serverRange = serverRange;
 }
 
  sync() {
    return super.sync().then ( (data) => {
      this.HTMLElement.dispatchEvent (new CustomEvent('sync',
        {  'detail' : data}));

      this.setValue(osc_script_to_single_value(data), true);
      return data;
    });
  }
  
  /*
   * Sends the script to zyn. `params` is a string or an array equal to 
   *  the `oscpath` property
   */
  act(params = undefined) {
    return super.act(params).then ( (data) => {
      this.HTMLElement.dispatchEvent (new CustomEvent('act',
        { 
          'detail' : {'script' : data}
        }));
      return data;
    });
  }

  
  /*
   * ''Abstract'' methods
   * setValue
   */
  setValue(value, fromServer=false) {
    this.HTMLElement.dataset.oscValue = value;
  }
  
  setEnabled(bool) {
    if (bool)
      this.HTMLElement.classList.remove('disabled');
    else
      this.HTMLElement.classList.add('disabled');
  }
  
  isEnabled() {
    return !this.HTMLElement.classList.contains('disabled');
  }
  /*
   * Note to self: Discourage 'getValue', as the value does not
   * really represent what's going on with zyn.
   */
}

/*
 * OSCButton elements
 * OSC buttons can store their value into `value` therefore
 * should be of <button> tag.
 */

class OSCButton extends OSCElement {
  constructor(clickableObject, bind = undefined, range = undefined){
    super(clickableObject, bind, range);
    
    clickableObject.addEventListener('click', () => {
      if (this.HTMLElement.dataset.oscType != "")
        this.act(this.HTMLElement.value);
      else
        this.act();
    });
  }
}

/*
 * OSCBoolean elements only send T or F
 * To get any value change, listen to sync events on the html div
 * 
 * Note to self: do not mix setEnable() with setValue()
 */
class OSCBoolean extends OSCElement {
  constructor(clickableObject, bind = undefined) {
    super(clickableObject, bind,  BOOL_RANGE);
    this.HTMLElement.dataset.oscValue = 'T';
    
    if (this.HTMLElement.querySelector('.content') == null) {
      if (this.HTMLElement.classList.contains('minimal') &&
        this.HTMLElement.dataset.label != null) {
          this.setContent(this.HTMLElement.dataset.label);
      } else {
        this.setContent('<i class="fa fa-power-off"></i>');
      }
    }
    
    
    this.boundObjects = [];
    
    clickableObject.addEventListener('click', () => {
      
      var value = (clickableObject.dataset.oscValue == 'T')
         ? false : true;
      
      this.act(OSC_BOOL(value)).then( () =>{
        
        this.setValue(value, false);
        /*
        this.HTMLElement.dispatchEvent( 
          new CustomEvent('act', {
              'detail':[value]
          }));
          */
        displayOutcome(`${this.label} is `+ (value ? 'ON' : 'OFF'));
      });
    });
  }
  
  
  setValue(bool) {
    let oscBool = OSC_BOOL(bool);
    this.HTMLElement.dataset.oscValue = oscBool;
    this.refresh();
  }
  
  /**
   * This is not ok anymore
   */
   /*
  isEnabled() {
    return this.HTMLElement.dataset.oscValue == 'T';
  }*/
  
  /* 
   * sets the enable / disable status bind to osc controllers 
   * ids is a list of IDS not objects
   * 
  */
  bindEnable (...ids) {
    this.boundObjects = this.boundObjects.concat(Array.from(arguments));
  }
  
  setEnabled(bool) {
    super.setEnabled(bool);
    this.refresh();
  }
  
  refresh() {
    let on = this.HTMLElement.dataset.oscValue == 'T';
    this.boundObjects.forEach ( (id) => { 
        window.zsession.oscElements[id].setEnabled(on); 
    });
  }
}

class OSCKnob extends OSCElement {
  constructor(div, bind = undefined, 
    range = undefined) {
    super(div, bind, range);
    
    let knobElement = document.createElement("div");
    knobElement.classList.add( 'icon', 'i-knob');
    knobElement.style.rotate = `${KNOB_DEGREE.min}deg`; //default value
    this.setContent(knobElement);
    //div.appendChild(knobElement);
    this.knob = knobElement;
        
    //bind to value
    //bind to visual knob
    knobElement.addEventListener('click', () => {
      loadKnobEditor(this);
    });
  }
  
  //rotation must be in RANGE format
  setRotation(value) {
    let rotation = convert_value(this.range, KNOB_DEGREE, value);
    this.knob.style.rotate = `${rotation}deg`;
  }
  
  setValue(value, fromServer=false) {
    if (value == undefined) {
      console.log(`${this.label} knob: undefined value to set.`);
      return;
    }
   
   //this conversion may be called from osc_synch
    if (fromServer) value = 
      convert_value(this.serverRange, this.range, value);
      
    this.knob.dataset.value=value;
    this.setRotation(value);
  }
  
  act(value) {
    let serverValue;
    
    if (value === undefined) {
      serverValue = convert_value(this.range, this.serverRange,
        parseInt(this.knob.dataset.value) );
        return super.act(serverValue);
    } else {
      serverValue = convert_value(this.range, this.serverRange, value);
      return super.act(serverValue).then ( ()=> {this.setValue(value);});
    }
  }
  
  /*
   * returns the value from `rotation` or from current rotation
   */
  getRotationValue(rotation) {
    if (rotation == undefined)
      rotation = (this.knob.style.rotate != "")
        ? parseInt(this.knob.style.rotate.slice(0,-3))
        : KNOB_DEGREE.min;
    
    return convert_value(KNOB_DEGREE, this.range, rotation);
  }
}


class InertKnob extends OSCKnob {
  constructor(div, range = undefined) {
    super(div, undefined, range);
    
    window.zsession.elements[div.id] = this;
    //delete window.zsession.oscElements[div.id];
    
    this.value = null;
  }
  
  sync() {
    this.HTMLElement.dispatchEvent(new CustomEvent('sync',
      {'detail': this.value} ));
    return Promise.resolve(this.value);
  }
  
  act(value) {
    this.setValue(value);
    this.HTMLElement.dispatchEvent( new CustomEvent('sync',
      {'detail': this.value} ));
    return Promise.resolve(this.value);
  }
  
  getValue() {return this.value}
  setValue(value, fromServer=true) {
    super.setValue(value, true);
    this.value = value;
  }
  
}
/*
 * OSC Swipeables
 */

class OSCSwipeable extends OSCElement {
  constructor(clickableObject, options, labels, swipeableData){
    super(clickableObject);
    
    //this.swipeableData = swipeableData;
    
    this.setContent('');
    let div = clickableObject.querySelector('.content');
    div.classList.add('swipeable');
    
    this.swipeable = new Swipeable(div);
    
    //createSwipeable(div, options, labels, swipeableData);
    this.selectElement = clickableObject.querySelector('select');
    this.selectElement.addEventListener('change',
      (ev) => {
          this.act(
            this.selectElement
              .options[this.selectElement.selectedIndex].value
          );
      });
    
    this.swipeable.setOptions(options, labels);
    
    //pseudo multi-inheritance
    this.setOptions = this.swipeable.setOptions.bind(this.swipeable);
    this.swipeable.setDialogData(swipeableData);
  }
  
  setValue(value, fromServer=false) {
    value = (value === undefined) ? 0 : value;
    for (let i = 0; i < this.selectElement.length; i++) {
        if (this.selectElement.options[i].value == value) {
          this.selectElement.selectedIndex = i;
          this.HTMLElement.querySelector('label').
            innerHTML = this.selectElement.options[i].innerHTML;
        }
    }
  }
}

class OSCNumber extends OSCElement {
  constructor(clickableObject, onClick = undefined){
    super(clickableObject);
    this.setContent(document.createElement('p'));
    if (onClick !== undefined)
      clickableObject.addEventListener('click', onClick);
  }
  

  setValue(text, fromServer) {
    this.HTMLElement.querySelector('.content > p')
      .innerHTML = text;
  }
}

class OSCMidiNote extends OSCNumber {
  constructor(clickableObject) {
    super(clickableObject);
    
    clickableObject.addEventListener('click', (e)=>{
      let currentPanel = document.querySelector('section.opened');
      
      window.zsession.noteEditor.showNoteEditor(this.lastNote.code, 
        (res) =>{
          this.act(res).then( () => {
            this.setValue(res);
            displayOutcome(`set note to ${this.lastNote.str}`);
          });
      });
    })
  }
  
  setValue(note, fromServer=false) {
    let noteObj = midiNote(note);
    if (noteObj != null) {
      super.setValue(noteObj.str);
      this.lastNote = noteObj;
    } else
      displayOutcome(`invalid note ${note}`, true);
  }
}

// click: enable/disable, swipe: enter section
class OSCPathElement extends OSCBoolean {
  constructor (clickableObject, bind=undefined, onswipe ) {
    super(clickableObject,bind);
   enableSwiping(clickableObject, 2);
   enableMultiTouch(clickableObject);
   clickableObject.addEventListener('pressed', onswipe);
   clickableObject.addEventListener('swipe', onswipe);
  }
  
  setLabel(label) {
    this.label = label;
  }
  
  setContent(content) {
    this.HTMLElement.classList.add('content');
  }
}

class OSCTempo extends OSCNumber {
  constructor(clickableObject) {
    super(clickableObject);
    this.bypassable = null;
    this.lastValue='';
    
    clickableObject.addEventListener('click', (ev)=>{
      let osc = zsession.oscElements[clickableObject.id];
      let result = prompt ('Input time fraction according to bpm. 0 to enable manual.',
        this.lastValue);
      if (result == "0" || result == "") result = "0/0";
      let rex = /(\d+)[^\d]+(\d+)/.exec(result);
      try {
        let params = [parseInt(rex[1]), parseInt(rex[2])];
        osc.act(params).then ( ()=>{
          osc.setValue(`${params[0]}/${params[1]}`, false);
          if (osc.bypassable != null)
            osc.bypassable.setEnabled(result != "0/0");
        });
      } catch (err) {
        displayOutcome(err,true);
        return;
      }
    });
  }
  
  
  setOscPath(path) {
    this.oscpath = [
      `${path}/numerator`,
      `${path}/denominator`
    ];
  }
  
  setValue(value, fromServer=false) {
    if ( !fromServer ) {
      this.lastValue = value;
      super.setValue(value);
    }
    else {
      let paths = Object.keys(value);
      if ( paths[0].endsWith ('numerator') )
        this.lastValue = `${value[paths[0]]}/${value[paths[1]]}`;
      else
        this.lastValue = `${value[paths[1]]}/${value[paths[0]]}`;
      
      super.setValue(this.lastValue);
    }
  }
}

class OSCFader extends OSCElement {
  constructor(fader, range) {
    super(fader, null, range);
    fader.min = range.min;
    fader.max = range.max;
    fader.orient = 'vertical';
    
    fader.addEventListener('change', ()=>{
      let value = fader.value;
      if (this.serverRange != this.range)
        value = convert_value(this.range, this.serverRange, value);
      
      super.act(value);
    });
  }
  
  setValue(value, fromServer=false){
    if (fromServer && this.serverRange != this.range)
      value = convert_value(this.serverRange, this.range, value);
    
    this.HTMLElement.value = value;
  }
  
  setContent(){}
  setLabel(){}
}
