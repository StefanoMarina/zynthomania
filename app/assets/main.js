/*********************************************************************
 * Zynthomania
 * Copyright (C) 2024- Stefano Marina
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
 
/*
 * MAIN
 */

//from 0 to 15
const OneToSixteen = [...Array(16).keys()].map(i => i + 1);


//small writing utility
window.__ID = document.getElementById.bind(document);


function onLoad() {
  //timers
  window.timers = {};
  
  window.zsession = {
    oscElements : {},  //OSCelement class pointers
    elements : {},
    banks: {},
    bank : '', //current bank
    partID : 0, //current part id
    layerID : 0, //current kit id
    fxcursor : '', //current fx path
    synthID : 'ad', //adsynth
    synthname : 'adpars', //synth osc element
    synthcursor: 'part0/kit0/adpars/VoicePar0',
    voiceID : 0, //adsynth voice id, 127 for 'global'
    osccursor : 'part0/kit0/adpars/VoicePar0/OscilSmp', //current 
    lastLoadedInstrument: Array(16),  //program id
    bindListEditor: {  //bindings
      currentSession : null
    },
    lastosc: {},
    reloadStack : [],
    
    setCopy : function ( type, path, pasteFunc ) {
      this.clipboard = {'type' : type, 'path' : path, 'onPaste' : pasteFunc};
    }
  };
  
  Object.defineProperty(zsession, 'reloadSynthSubSection', {
    get() {
      return (this.reloadStack.length == 0)
        ? function () {console.log('warning: called subsection with empty stack');}
         : this.reloadStack[this.reloadStack.length-1];
    },
    
    set(func) {
      if (this.reloadStack.length == 0
        || func != this.reloadStack[this.reloadStack.length-1]) //prevent doubles
      this.reloadStack.push(func);
    }
  });
  
  initKnobEditorDialog(); //knob-panel.js
  
  /*
   * Global buttons init
   */
  
  zsession.oscElements['global-volume'] = 
    new OSCKnob(document.getElementById('global-volume'));
  zsession.oscElements['global-volume']
    .setLabel("Master volume", "Master");
  
  new OSCButton(document.getElementById('global-panic'))
    .setLabel("Panic", "Panic");
  
  new OSCLabel(document.getElementById('global-tempo'));
  
/*
 * Part main controls
 */
  
  // PART ID SWIPE
  let labels = OneToSixteen.map( (val, index, arr) => 
      {return "P"+String(index+1).padStart(2,'0');}
  );
    
  let partSwipe = new Swipeable(document.getElementById("partID"));
  partSwipe.setOptions(OneToSixteen, labels);
  partSwipe.setDialogData({title : 'Change part', buttonClass : 'col-4'});
  partSwipe.selectElement.addEventListener('change', (ev) => {
      onToolbarChangePart(ev.target.selectedIndex);
  })
 
  /* Section controls */ 
  //enable section back button
  document.getElementById('content-back').addEventListener('click', (e) =>{
    let backButton = document.getElementById('content-back');
    
    if (zsession.reloadStack.length > 0) {
      zsession.reloadStack.pop(); //remove current section
      zsession.reloadSynthSubSection();
    } else
      loadSection(backButton.dataset.backToPanel);
  });
 
 loadSection('section-welcome');
  new ZynthoREST().query('files/favorites').then ( (favs) => {
    zsession.favorites = favs;
    return new ZynthoREST().query('status/session');
  }).then ( (sess)=> {
    zsession.extdata = sess;
    
    //Init part
    onToolbarChangePart(0);
  });
}

function setSelectedToolbarButton(button) {
  document.querySelectorAll('#main-header button.selected')
    .forEach ( (btn) => btn.classList.remove('selected') );
  button.classList.add('selected');
}

/*
 * Loads a section
 * TODO: Unload all unnecessary osc elements
 */
function loadSection(sectionID, subsection=false) {
  let section = document.getElementById(sectionID);
  if (section == null){
    console.log('error: cannot find section ' + sectionID);
    return;
  }
  
  if (subsection) {
      let main_section = document.querySelector('section.opened');
      if (main_section != null && main_section.id != sectionID)
        section.dataset.back = main_section.id;
  }
  
  document.querySelectorAll("section.opened")
    .forEach ( (sel) => sel.classList.remove("opened"));
  
  document.getElementById('content-title').innerHTML =
     (section.dataset.title)
      ? section.dataset.title
      : '';
  
  let backButton = document.getElementById('content-back');
  if (section.dataset.back) {
    backButton.classList.remove('hidden');
    backButton.dataset.backToPanel = section.dataset.back;
  } else
   backButton.classList.add('hidden');
   
   section.classList.add('opened');
  
  showIf ('synth-header', sectionID.indexOf('synth') > -1);
  if ( sectionID.indexOf('synth') > -1 ){
    
  } else {
    zsession.reloadStack = [];
  }
  
  let showToolbar = false;
  
  //clipboard
  if (section.dataset.copy == null){
    document.getElementById('clipboard-paste').disabled = true;
    document.getElementById('clipboard-copy').disabled = true;
  } else {
    showToolbar = true;
    document.getElementById('clipboard-copy').disabled = false;
    document.getElementById('clipboard-paste').disabled = 
      ( zsession.clipboardServerType === undefined 
          || zsession.clipboardServerType != section.dataset.copy
      );
  }
    
  //presets
  let presetSel = document.getElementById('toolbar-presets');
  presetSel.options.length = 1;
  
  if ( section.dataset.preset) {
    presetSel.dataset.bank = section.dataset.preset;
    presetSel.options[0].text= 'Select a preset';
    presetSel.disabled = false;
    showToolbar = true;
    
    new ZynthoREST().query('presets', {'bank': section.dataset.preset })
      .then ( (presets) => {
        presets.forEach ( (pr)=> presetSel.options.add(
          new Option ( pr, pr ) ) );
        presetSel.selectedIndex = 0;
    });
  } else {
    presetSel.options[0].text = 'No presets';
    presetSel.disabled = true;
  }
    
  let sectionToolbar = document.getElementById('section-toolbar');
  showIf(sectionToolbar, showToolbar && sectionToolbar.classList
    .contains('hidden') == false);
  showIf('show-toolbar', showToolbar);
}

function onShowToolbar() {
  let sectionToolbar = document.getElementById('section-toolbar');
  showIf(sectionToolbar, sectionToolbar.classList.contains('hidden'));
}


/* DEBUG SCRIPT OSC */

function debug_script(res, script) {
  new ZynthoREST().post('script', 
  { 'requestResult' : res,
    'script' : script
  }).then ( (data)=>console.log(data));
}

//removes decimals
function toFixed(num, fixed) {
    var re = new RegExp('^-?\\d+(?:\.\\d{0,' + (fixed || -1) + '})?');
    return num.toString().match(re)[0];
}

/*
 * cursor can be ad, sub, pad or undef
 * undef refreshes cursors
 */
function set_synth_cursor(cursor) {
  if (cursor == undefined)
    cursor = zsession.synthID;
  
  zsession.synthID = cursor;
  zsession.synthname = `${cursor}pars`;
  
  switch (cursor) {
    case 'ad' : {
        zsession.synthcursor = osc_sanitize('part/kit/synth/voice');
        zsession.osccursor = osc_sanitize('synthcursor/OscilSmp');
      break;
    }
    case 'sub' : {
      zsession.synthcursor = 
      zsession.osccursor =
        osc_sanitize('part/kit/synth');
      break;
    }
    case 'pad' : {
      zsession.synthcursor = osc_sanitize('part/kit/synth');
      zsession.osccursor = osc_sanitize('synthcursor/oscilgen');
      break;
    }
  }
  
 document.querySelectorAll('#synthSelector button.selected')
      .forEach ( (btn)=>btn.classList.remove('selected'));
  document.getElementById(`synth-toolbar-${zsession.synthID}-enabled`)
          .classList.add('selected');
          
  showIf('adsynth-voice', cursor == 'ad');
  showIf('padpars-prepare', cursor == 'pad');
}

/**
 * helper that adds/remove disable/hidden class on necessity
 */
function showIf ( elementOrId, bool, className="hidden" ) {
  let element =  (typeof elementOrId === "string")
    ?  document.getElementById(elementOrId)
    : elementOrId;
  
  if (element ==null ) throw 'showIf: undefined element';
  
  if (bool)
    element.classList.remove(className);
  else
    element.classList.add(className);
} 

function selectIf ( elementOrId, bool, className = 'selected') {
  return showIf (elementOrId, !bool, className);
}

function enableMultiTouch(element, time = 500) {
  element.time = time;
  element.addEventListener('touchstart', (event)=> {
    element.start = Date.now();
  });
  element.addEventListener('touchend', (event)=> {
    let duration  = Date.now()-element.start;
    delete element.start;
    
    if (duration > element.time)
      element.dispatchEvent(new CustomEvent('pressed'));
    
  });
}

function onToggleButtonClick(event) {  
  showIf(event.target, event.target.classList.contains('selected'), 'selected');
}

function setLastOSC(oscpath, range) {
  zsession.lastosc.osc = oscpath;
  zsession.lastosc.range = range;
  
  document.getElementById('osc-message').innerHTML = 
    (Array.isArray(oscpath)) ? '[Multiple OSC]' : oscpath;
}

function fileDialog(mode="open", files, data, onOk) {
  let filedialog = document.getElementById('file-dialog');
  
  if (zsession.initFileDialog === undefined) {
    document.getElementById('file-dialog-cancel')
      .addEventListener('click', ()=> {
        filedialog.open = false;
      });
  
    document.getElementById('file-dialog-ok')
      .addEventListener('click', (event) =>{
          
        //ask if same file
        let input = document.getElementById('file-dialog-filename');
        let filename = input.value;
        
        if (mode == 'save' &&
            data['extension'] && 
            !filename.endsWith(data['extension']))
        {
          input.value = filename = `${filename}.${data.extension}`;
        }
        
        let stop = false;
        if (filename = '') {
          stop = true;
        } else if (filename.search(/\..*$/)>-1) {
          alert('No extension on files please');
          stop = true;
        } else  if (filename.search(/[\/]/)>-1) {
          alert('No paths please');
          stop = true;
        }
        
        if (mode=='save' && files.indexOf(filename) != -1) {
          let stop = !confirm("Overwrite?");
        }
        
        if (stop) {
          event.stopPropagation();
        } else 
          filedialog.open = false;
      });
    
    zsession.initFileDialog = true;
  }
  
  let title = filedialog.querySelector("header");
  if (mode == "open") {
    title.innerHTML = 'Open file';
    document.getElementById('file-dialog-filename').disabled = true;
  } else  {
    title.innerHTML = 'Save file';
    document.getElementById('file-dialog-filename').disabled = false;
  }

  let fileList = document.getElementById('file-dialog-file-list');
  fileList.innerHTML = '';
  
  for (file of files) {
    let entry = document.createElement('li');
    entry.innerHTML = file;
    entry.addEventListener('click', onFileDialogFileClick);
    fileList.append(entry);
  }
  
  document.getElementById('file-dialog-filename').value = '';
  
  document.getElementById('file-dialog-folder').innerHTML = data['folder'];
  document.getElementById('file-dialog-ok')
    .addEventListener('click', onOk, {once: true});
  
  filedialog.open = true;
}

function onFileDialogFileClick(event) {
  let list = event.target;
  if (list.classList.contains('selected')) {
    list.classList.remove('selected');
  }
  
  document.getElementById('file-dialog-file-list')
    .querySelectorAll('li.selected').forEach ( (el) => el.classList.remove('selected'));
  
  list.classList.add('selected');
  document.getElementById('file-dialog-filename').value = 
    list.innerHTML;
}

// from zyntho.js
function effectTypeToString(type, reduced = false) {
  switch (type) {
     case 0: return (reduced) ? '-' : 'None'; break;
     case 1: return (reduced) ? 'Rev' : 'Reverb'; break;
     case 2: return (reduced) ? 'Ech' : 'Echo'; break;
     case 3: return (reduced) ? 'Cho' : 'Chorus'; break;
     case 4: return (reduced) ? 'Pha' : 'Phaser'; break;
     case 5: return (reduced) ? 'Wah' : 'Alienwah'; break;
     case 6: return (reduced) ? 'Dis' : 'Distorsion'; break;
     case 7: return 'EQ'; break;
     case 8: return (reduced) ? 'Fil' : 'DynamicFilter'; break;
     default: return (reduced) ? '??' : `Unk (${type})`; break;
  }
}

function initSynthToolbar() {
  if (zsession.initSynthMain === undefined) {
    
    // Synth toolbar init
    let zeroTo15 = [...Array(16).keys()];
    let swipe = new Swipeable(document.getElementById('synth-layer'));
    swipe.setOptions(zeroTo15, 
      zeroTo15.map ( el => "L"+(String(el+1).padStart(2,0)) )
    );
    swipe.setDialogData({'title': 'Select layer', 'buttonClass' : 'col-4'});
    swipe.selectElement.addEventListener('change', onSynthToolbarUpdate);
   
    let toolbarUpdateObject = new OSCBundle(['/part/kit/Padenabled',
        '/part/kit/Psubenabled', '/part/kit/Ppadenabled',
        '/part/kit/Penabled']);
    zsession.oscElements['bundle-synth-toolbar'] = toolbarUpdateObject;
    
    let layerStatus = new OSCBoolean(
      document.getElementById('synth-toolbar-layer-enabled'));
    layerStatus.label = 'Layer enabled';
    
    swipe = new Swipeable(document.getElementById('adsynth-voice'));
    let zeroToEight = [...Array(8).keys()];
    swipe.setOptions(
      [ADSYNTH_GLOBAL,...zeroToEight],
      ['Global'].concat(zeroToEight.map ( 
        (el) => 'V'+(String(el+1).padStart(2,0))
        )
      ));
    swipe.setDialogData({'title': 'Select voice', 'buttonClass' : 'col-3'});
    swipe.selectElement.addEventListener('change', onSynthToolbarVoiceUpdate);
    swipe.setValue(zsession.voiceID);
    
    zsession.elements['adsynth-voice'] = swipe;
    
    new OSCButton(document.getElementById('padpars-prepare'));
    zsession.initSynthMain = true;
  }
}
