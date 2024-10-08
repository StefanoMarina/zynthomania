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
          .replace(/part(?=(\/|$))/, `part${window.zsession.partID}`)
          .replace('/fxcursor', window.zsession.fxcursor)
          .replace('kit/', `kit${window.zsession.layerID}/`)
          .replace('#synth#', window.zsession.synthID)
          .replace('synth/', window.zsession.synthname+'/')
          .replace(/voice(?=(\/|$))/, `${voice_translate}`);
}

//Reduce a sync result data object to its last parameters, removing
//unnecessary arrays.
function osc_map_to_control(data) {
  res = {};
  for (let [key,value] of Object.entries(data)) {
    let reskey = /\/([[\w\d ]+)$/.exec(key)[1];
    res[reskey] = (value.length == 1) ? value[0] : value;
  }
  return res;
}

/**
 * This function turns single element array into direct value
 * If the array contains more than one element,
 * the original array is returned instead.
 * @returns either a single value or an array
 */
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
  if ( typeof section === 'string')
    section = __ID(section);
    
  var allElements = Array.from(
    section.querySelectorAll('.osc-element')
  ). filter ( (el) => (force)
      ? el 
      : (el.dataset.oscPath !== undefined
        && !el.classList.contains('osc-button'))
  )
  .map ( el => el.id);
  
  if (allElements.length == 0) {
    console.log('osc_synch_section: empty request');
    return Promise.resolve(0);
  }
  
  return osc_synch(...allElements);
}

function osc_synch(...elements) {
  let objects = Array.from(arguments).map ( (id) => zsession.oscElements[id] )
      .filter( element => element != undefined && element.isEnabled() && 
      (element.oscpath != null) );
  
  if (objects.length == 0) {
    console.log(`osc_synch: empty request despite original length ${elements.length}`);
    return Promise.resolve(0);
  }
  
  let arrayObjects = objects.filter ( (obj) => Array.isArray(obj.oscpath));
  objects = objects.filter ( (obj) => !Array.isArray(obj.oscpath) && obj.oscpath != "" );
  
  /**
   * Bug
   * using this way we cannot assign arrays
   */
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
          if ( id === undefined) {
            console.log('warning! undefined id for path ' + path);
            continue;
          }
          
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
        
        if (arrayObjects.length > 0) {
          console.log('sync-ing multiple osc objects...');
          let promises = arrayObjects.map ( (obj) =>
            obj.sync() );
          return Promise.allSettled(promises);
        }
    })
    .catch ( (msg) => {
      displayOutcome('Synch error!', true);
    });
}


function osc_snapshot ( section, force = false ) {
  if (typeof section === 'string')
    section = __ID(section);
  
  let oscElements = Array.from(
    section.querySelectorAll('.osc-element'))
    .filter ( el => 
      !(el.classList.contains('hidden') ||
        el.offsetParent == null )
      && zsession.oscElements[el.id] )
    .map ( el => zsession.oscElements[el.id]);
  
  let paths = [];
  
  oscElements.filter ( el => el.toPreset).forEach ( (el) =>{
    let res = el.toPreset();
    if ( Array.isArray(res) )
      paths = paths.concat(res);
    else
      paths.push(res);
  });
  
  //console.log(paths);
  return paths;
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
          script[i] += ` ${params[i]}`;
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
  constructor(path, range = null) {
    super(path, range);
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
    
    if (clickableObject == null)
      throw `Error - creating osc object with null/undef html element.`;
      
    //Register element
    if (window.zsession.oscElements[clickableObject.id]) {
      let msg = `Error! ${clickableObject.id} already registered.`
      console.log(msg);
      throw msg;
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
    
    if (this.HTMLElement.tagName.toLowerCase() == 'input')
      this.HTMLElement.disabled = !bool;
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
  
  toPreset() {
    return this.getAbsolutePath() + ' ' 
      + this.HTMLElement.dataset.oscValue;
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
  
  toPreset() {
    return this.getAbsolutePath() + ' ' 
      + convert_value(this.range, this.serverRange,
        parseInt(this.knob.dataset.value) );
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
          return;
        }
    }
  }
  
  toPreset() {
    return this.getAbsolutePath()  + ' ' 
      + this.selectElement.value;
  }
}

class OSCLabel extends OSCElement {
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

class OSCMidiNote extends OSCLabel {
  constructor(clickableObject) {
    super(clickableObject);
    
    clickableObject.addEventListener('click', (e)=>{
      let currentPanel = document.querySelector('section.opened');
      
      if ( zsession.noteEditor === undefined )
        zsession.noteEditor = new NoteEditor();
      
      zsession.noteEditor.showNoteEditor(this.lastNote.code, 
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
  
  toPreset() {
    return this.getAbsolutePath() + ' '
      + this.lastNote.code;
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
   clickableObject.addEventListener('contextmenu', onswipe);
   clickableObject.addEventListener('contextmenu', (ev)=> { ev.stopPropagation(); ev.preventDefault()});
  }
  
  setLabel(label) {
    this.label = label;
  }
  
  setContent(content) {
    this.HTMLElement.classList.add('content');
  }
  
}

class OSCTempo extends OSCLabel {
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
  
  toPreset() {
    let path = this.getAbsolutePath();
    let values = /(\d+)\/(\d+)/.exec(this.lastValue);
    
    path[0] = path[0] + ' ' + values[1];
    path[1] = path[1] + ' ' + values[2];
    return path;
  }
}

class OSCFader extends OSCElement {
  constructor(fader, range=CC_RANGE) {
    super(fader, null, range);
    fader.min = range.min;
    fader.max = range.max;
    fader.classList.add('osc-fader');
    //fader.style['writing-mode'] = 'vertical-rl';
    
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
  
  toPreset() {
    return this.getAbsolutePath() + ' '
      + convert_value(this.range, this.serverRange,
        this.HTMLElement.value);
  }
}

const EQ_FILTER_TYPES = ['Off', 'Lp', 'Hp', 'Lp2', 'Hp2', 'Band', 'Notch', 'Peak', 'LoSh', 'HiSh'];

class OSCEQFilter extends OSCElement{
  constructor(container) {
    super(container, null, null);
    //this.container = container;
    
    //label
    this.label = document.createElement('header');
    this.label.classList.add('header');
    container.appendChild(this.label);
    
    //swipeable frequency
    let div = document.createElement('div');
    div.classList.add('osc-swipeable', 'minimal');
    div.id = `${container.id}-freq`;
    this.frequency = new OSCSwipeable(div,
      Object.values(EQ_RANGES),Object.keys(EQ_RANGES),
      {'title': 'Eq Frequency', 'buttonClass': 'col-3'}
    );
    this.label.appendChild(div);
    
    //gain
    let gain = document.createElement('input');
    gain.classList.add('osc-fader');
    gain.type = 'range';
    gain.id = `${container.id}-gain`;
    gain.classList.add('osc-fader');
    container.appendChild(gain);
    this.gain = new OSCFader(gain,CC_RANGE);
    
    //type
    div = document.createElement('div')
    div.classList.add('osc-swipeable', 'minimal');
    div.id = `${container.id}-type`;
    this.type = new OSCSwipeable(div,
      [...Array(EQ_FILTER_TYPES.length).keys()],
      EQ_FILTER_TYPES,
      {'title': 'Type', 'buttonClass': 'col-3'}
    );
    container.appendChild(div);
  
    this.type.swipeable.selectElement.addEventListener('change',
      (ev)=>{this.setEnabled(this.type.swipeable.selectElement.value)});
        
    //Q
    div = document.createElement('div');
    div.classList.add('osc-knob');
    div.id = `${container.id}-q`;
    this.q = new OSCKnob(div);
    this.q.setLabel('Q');
    container.appendChild(div);
    
    //Stages
    let stages = document.createElement('div');
    stages.classList.add('minimal', 'osc-swipeable');
    stages.id = `${container.id}-stages`;
    this.stages = new OSCSwipeable(stages,
      [...Array(5).keys()],[0,1,2,3,4],
      {'title': 'Stages (0 disable)', 'buttonClass': 'col-2'}
    );
    div.appendChild(stages);
  }
  
  setPath ( fxpath, filterID ) {
    this.oscpath = [
      `${fxpath}/EQ/filter${filterID}/Pfreq`,
      `${fxpath}/EQ/filter${filterID}/Pgain`,
      `${fxpath}/EQ/filter${filterID}/Ptype`,
      `${fxpath}/EQ/filter${filterID}/Pq`,
      `${fxpath}/EQ/filter${filterID}/Pstages`
    ];
    
    this.frequency.oscpath = this.oscpath[0];
    this.gain.oscpath = this.oscpath[1];
    this.type.oscpath = this.oscpath[2];
    this.q.oscpath = this.oscpath[3];
    this.stages.oscpath = this.oscpath[4];
  }
  
  sync() {
    return super.sync().then ( (data) => {
      this.setValue ({
        'Pfreq' : data[this.oscpath[0]][0],
        'Pgain' : data[this.oscpath[1]][0],
        'Ptype' : data[this.oscpath[2]][0],
        'Pq' : data[this.oscpath[3]][0],
        'Pstages' : data[this.oscpath[4]][0],
      }, true);
      
    });
  }
  
  toPreset() {
    if (this.type.swipeable.selectElement.value == 0)
      return this.type.toPreset();
    else
      return [
        this.frequency.toPreset(),
        this.gain.toPreset(),
        this.type.toPreset(),
        this.q.toPreset(),
        this.stages.toPreset()
      ];
  }
  
  setValue( obj, fromServer = true) {
    this.frequency.setValue(obj.Pfreq,fromServer);
    this.gain.setValue(obj.Pgain,fromServer);
    this.type.setValue(obj.Ptype,fromServer);
    this.q.setValue(obj.Pq,fromServer);
    this.stages.setValue(obj.Pstages,fromServer);
    this.setEnabled(obj.Ptype != 0);
  }
  
  setEnabled(enabled) {
    this.frequency.setEnabled(enabled);
    this.gain.HTMLElement.disabled = !enabled;
    this.q.setEnabled(enabled);
    this.stages.setEnabled(enabled);
  }
}

class OSCGraph extends OSCElement {
  constructor(container, dots, defValue=64, range=CC_RANGE) {
    super(container);
    this.defaultValue = defValue;
    this.dots = Array(dots).fill(defValue);
    this.currentDot = 0;
    
    this.canvas = document.createElement('canvas');
    this.canvas.classList.add('canvas','col-12');
    this.canvas.style.minWidth = `${dots}px`;
    
    //this.HTMLElement.appendChild(this.canvas);
    
    let CREATE_SLIDER = (id, max) => {
      let r = document.createElement('div');
      r.classList.add('row','no-gutters');
      
      let range = document.createElement('input');
      range.type = 'range';
      range.style.width='100%';
      range.id = `${container.id}-${id}`;
      range.name= range.id;
      range.min = 0;
      range.max = max;
      this[`${id}Range`] = range;
      
      let col = document.createElement('div');
      col.classList.add('col-10');
      col.appendChild(range);
      r.appendChild(col);
      
      col = document.createElement('div');
      col.classList.add('col-2');
      let label = document.createElement('p')
      label.classList.add('tc');
      //label.id = `${container.id}-${id}-label`;
      this[`${id}RangeLabel`] =label;
      col.appendChild(label);
      r.appendChild(col);
      
      return r;
    };
    
    let content = document.createElement('div');
    content.classList.add('container','content');
    content.appendChild(this.canvas);
    
    content.appendChild(CREATE_SLIDER('target', this.dots.length-1));
    //listen to select harmonic
    this.targetRange.addEventListener('input', ( ev ) => {
      this.currentDot = parseInt(this.targetRange.value);
      this.targetRangeLabel.innerHTML = this.currentDot;
      this.updateDot();
      this.drawBars();
    });
    
    content.appendChild(CREATE_SLIDER('value', range.max));
    
    let btn =document.createElement('button');
    btn.classList.add('selected', 'col-4', 'offset-8');
    btn.innerHTML = '<small>Reset</small>';
    btn.addEventListener('click', ()=>{
      this.setValue(Array(this.defaultValue));
    });
    
    content.append(btn);
    
     this.valueRange.addEventListener('change', ( ev ) => {
      this.dots[this.currentDot] = parseInt(this.valueRange.value);
      this.valueRangeLabel.innerHTML = this.valueRange.value;
      this.act(this.valueRange.value, this.currentDot).then ( ()=>{
        this.drawBars();
      });
    });
    
    this.targetRange.value = 0;
    this.targetRangeLabel.innerHTML = '0';
    this.updateDot();
    
    this.HTMLElement.appendChild(content);
    //this.setContent(content);
    this.oscpath = []; //force OSC synch to call sync()
  }
  
  drawBars() {
    let height = this.canvas.height;
    let step =  toFixed(this.canvas.width / this.dots.length, 2);
    let canvasHeight = {'min': 0, 'max' : height, 'itype' : 'i' };
    
    let ctx = this.canvas.getContext('2d');
    ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
    
    let mid = height-convert_value(this.range, canvasHeight, 
      Math.round(this.range.max/2));
    
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.strokeStyle = 'gray';
    ctx.lineWidth = 1;
    ctx.lineTo(this.canvas.width, mid);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(0, height-convert_value(this.range, canvasHeight, this.dots[0]));
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    for (let i = 0; i < this.dots.length; i++) {
      ctx.lineTo(i*step, height-convert_value(this.range, canvasHeight, this.dots[i]));
    }
    
    ctx.stroke();
    
    //draw selection
    ctx.beginPath();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    let prevDot = Math.max ( 0, this.currentDot-1 );
    let nextDot = Math.min ( this.dots.length-1, this.currentDot+1 );
    
    ctx.moveTo(prevDot*step, 
      height-convert_value(this.range, canvasHeight, this.dots[prevDot]));
      
    for (let i = prevDot; i < nextDot+1; i++)
      ctx.lineTo(i*step, height-convert_value(this.range, canvasHeight, this.dots[i]));
    ctx.stroke();
  }
  
  act (param, index) {
    return new ZynthoREST().post('script', 
      {'script' : `${this.HTMLElement.dataset.oscPath}${index} ${param}`})
    .then ( (data)=>{
      this.HTMLElement.dispatchEvent (new CustomEvent('act',
        {  'detail' : data}));
      this.updateDot();
      return data;
    });
  }
  
  sync() {
    //this.displayScript();
    let path = osc_sanitize(this.HTMLElement.dataset.oscPath)
      + `[0-${this.dots.length-1}]`;
      
    return new ZynthoREST().query('script/harmonics', {
      'path' : path
    }).then ( (data) => {
      this.HTMLElement.dispatchEvent (new CustomEvent('sync',
        {  'detail' : data}));

      this.setValue(data, true);
      
      return data;
    });
  }
  
  toPreset() {
    let path = osc_sanitize(this.HTMLElement.dataset.oscPath);
    let paths = Array(this.dots.length);
    
    for (let i = 0; i < paths.length; i++){
      paths.push(path + `${i} ` + convert_value(this.range,
        this.serverRange, this.dots[i]));
    }
    
    return paths;
  }
  
  setValue(values) {
    this.dots = values;
    this.drawBars();
    this.updateDot();
  }
  
  updateDot() {
    this.valueRange.value = 
    this.valueRangeLabel.innerHTML = 
      this.dots[this.targetRange.value];
  }
}

class OSCEnvelope extends OSCElement {
  constructor ( container ) {
    super(container);
    
    //button bar
    let row = document.createElement('div');
    row.classList.add('row', 'justify-content-center');
    
    let swipediv = document.createElement('div');
    swipediv.classList.add('swipeable');
    swipediv.id = `${container.id}-swipe`;
    
    this.swipeable = new Swipeable(swipediv);
    this.swipeable.setDialogData(
      {'title': 'Envelope point', 'buttonClass': 'col-6' });
      
    //this.navbar = document.createElement('nav');
    
    this.swipeable.selectElement.addEventListener('change', (ev)=>{
      this.setCurrentPoint(ev.target.options[ev.target.selectedIndex].value);
    });
    
    row.appendChild(swipediv);
    
    //graph
    this.canvas = document.createElement('canvas');
    this.canvas.classList.add('canvas');
    let content = document.createElement('div');
    content.classList.add('content');
    content.appendChild(row);
    content.appendChild(this.canvas);
    
    let CREATE_SLIDER = (id, max) => {
      let r = document.createElement('div');
      r.classList.add('row','no-gutters');
      
      let range = document.createElement('input');
      range.type = 'range';
     // range.style.width='100%';
      range.classList.add('osc-fader-h');
      range.id = `${container.id}-${id}`;
      range.name= range.id;
      range.min = 0;
      range.max = max;
      this[`${id}Fader`] = new OSCFader(range);
      
      let col = document.createElement('div');
      col.classList.add('col-10');
      col.appendChild(range);
      r.appendChild(col);
      
      col = document.createElement('div');
      col.classList.add('col-2');
      let label = document.createElement('label')
      label.classList.add('tc');
      label.id = `${container.id}-${id}-label`;
      label.for = range.id;
      range.addEventListener('change', (ev) => {
        label.innerHTML = range.value;
      });
      //this[`${id}RangeLabel`] =label;
      col.appendChild(label);
      r.appendChild(col);
      
      return r;
    };
    
    content.appendChild(CREATE_SLIDER('x',127));
    content.appendChild(CREATE_SLIDER('y',127));
    
    
    
    this.xFader.HTMLElement.addEventListener('change', (ev)=>{
      let value = parseInt(ev.target.value);
      this.envelope.points[this.currentPoint].time = value;
      this.drawEnvelope();
    });
    this.yFader.HTMLElement.addEventListener('change', (ev)=>{
      let value = parseInt(ev.target.value);
      this.envelope.points[this.currentPoint].value = value;
      this.drawEnvelope();
    });
    
    
    container.appendChild(content);
  }
  
  setEnvelope(path, mode, cutoffpath = null)  {
    this.sourcePath = osc_sanitize(path);
    this.oscpath = [];
    switch (mode) {
      case 'vco' : this.envelope = new VCOEnvelope(this.sourcePath);break;
      case 'vca' : this.envelope = new VCAEnvelope(this.sourcePath);break;
      case 'vcf' : this.envelope = new VCFEnvelope(this.sourcePath, cutoffpath);break;
    }
    
    this.envelope.points.forEach ( (point) => {
      if (point.timepath!=null)
        this.oscpath.push(point.timepath);
      if (point.valuepath!=null)
        this.oscpath.push(point.valuepath);
    });
    
    let availableButtons = this.envelope.points.filter ( p => !p.disabled);
    this.swipeable.setOptions(
      availableButtons.map ( p => this.envelope.points.indexOf(p) ),
      availableButtons.map ( p => p.label)
    );
    this.setCurrentPoint(0);
  }
  
  setCurrentPoint(index) {
    this.currentPoint = index;
    this.drawEnvelope();
    
    let point = this.envelope.points[index];

    showIf(this.xFader.HTMLElement.parentNode.parentNode, 
      point.timepath != null);
    showIf(this.yFader.HTMLElement.parentNode.parentNode, 
      point.valuepath != null);
    
    this.xFader.oscpath = point.timepath;
    this.yFader.oscpath = point.valuepath;
    
    this.xFader.HTMLElement.value = point.time;
    document.getElementById(`${this.HTMLElement.id}-x-label`)
      .innerHTML = point.time;
    this.yFader.HTMLElement.value = point.value;
    document.getElementById(`${this.HTMLElement.id}-y-label`)
      .innerHTML = point.value;
  }
  
  setValue(data, fromServer=true) {
    this.envelope.points.forEach ( point => {
      if (point.timepath != null)
        point.time = data[point.timepath][0];
      if (point.valuepath != null)
        point.value = data[point.valuepath][0];
    });
    
    this.drawEnvelope();
  }
  
  toPreset() {
    let usefulPoints = this.envelope.points
      .filter ( point => point.timepath || point.valuepath );
    
    let result = [];
    usefulPoints.forEach ( (point) => {
      if ( point.timepath) 
        result.push(`${point.timepath} ${point.time}`);
      if ( point.valuepath) 
        result.push(`${point.valuepath} ${point.value}`);
    });
    
    return result;
  }
  
  drawEnvelope() {
    let ctx = this.canvas.getContext('2d');
    ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
    
    let mid = Math.floor(this.canvas.height/2);
    
    //gray 64 line
    ctx.strokeStyle = 'gray';
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(this.canvas.width, mid);
    ctx.stroke();
    
    let poles = this.envelope.convertPoints(this.canvas.width,
      this.canvas.height);

    this.drawPoles(ctx, poles);
  
  }
  
  testLine ( x, y, x2, y2) {
     let ctx = this.canvas.getContext('2d');
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.lineTo(x2,y2);
      ctx.stroke();    
  }
  
  drawPoles(ctx, poles) {
    //draw values
    ctx.strokeStyle = 'gray';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'gray';
    ctx.font = '14px LCD';
    
    let cursor = 0;
    
    //write label 0
    if (poles[0].label) {
      ctx.fillText(poles[0].label, 4, 12);
    }
    
    for (let i = 1; i < poles.length; i++) {
      cursor += poles[i].pos[0];
      
      if (!poles[i].label)
        continue;
        
      let pole = poles[i];
      ctx.beginPath();
      ctx.moveTo(cursor, 0);
      ctx.lineTo(cursor, this.canvas.height);
      ctx.stroke();
      
      let posX = (i == poles.length-1) 
        ? cursor - (ctx.measureText(poles[i].label).width + 4 )
        : cursor + 4;
      //let posY =  Math.floor((pole.pos[1]+poles[i-1].pos[1])/2);
      
      ctx.fillText(poles[i].label, posX, 12);
    }
    
    //draw lines
    cursor = 0;
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < poles.length-1; i++) {
      let pole = poles[i];
      cursor += pole.pos[0];
      
      if (poles[i+1].style) {
        ctx.stroke(); //close previous line
        ctx.beginPath();
        ctx.strokeStyle = poles[i+1].style;
      }
      ctx.moveTo(cursor, pole.pos[1]);
      ctx.lineTo(cursor+poles[i+1].pos[0], poles[i+1].pos[1]);
    }
    ctx.stroke();
    
    //draw dots
    cursor = 0;
    for (let i = 0; i < poles.length; i++) {
      cursor += poles[i].pos[0];      
      if ( poles[i].disabled ) {
        ctx.fillStyle = 'gray';
        ctx.beginPath();
        ctx.arc ( cursor, poles[i].pos[1], 4, 0, Math.PI*2);
        ctx.fill();
      } else  {
        ctx.fillStyle = (i == this.currentPoint) ? 'red' : 'black';
        ctx.fillRect ( cursor-4, poles[i].pos[1]-4, 8, 8);
      }
    }
  }
}
