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

function onLoad() {
  //timers
  window.timers = {};
  
  /*window.zsession = {
    oscElements : {},
    
    buttons : {},
    instruments : [],
    instrument : {}, //current instrument
    partefx : new Array(15), //last part efx query
    fx : { path : ''}, //fx panel data
    banks : {}, //banks panel data
    bind : {
      current : null,
      info : { channel : 1, source: 'cc'}
    } //bind editor data
  };*/
  
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
    bindListEditor: {  //bindings
      currentSession : null
    },
    lastosc: {}
  };
  
  initKnobEditorDialog(); //knob-panel.js
  
  /*
   * Global buttons init
   */
  
  window.zsession.oscElements['global-volume'] = 
    new OSCKnob(document.getElementById('global-volume'));
  window.zsession.oscElements['global-volume']
    .setLabel("Master volume", "Master");
  
  new OSCButton(document.getElementById('global-panic'))
    .setLabel("Panic", "Panic");
  
  new OSCNumber(document.getElementById('global-tempo'));  
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
 
  // 'Part Mixer' is the default opened so it's initialized here
  
  window.zsession.oscElements['part-enable'] =
    new OSCBoolean(document.getElementById('part-enable'));
  window.zsession.oscElements['part-enable'].setLabel('Enable');
  
  let volumeKnob = new OSCKnob(document.getElementById('part-volume'));
  volumeKnob.setLabel('Volume');
  window.zsession.oscElements['part-volume'] = volumeKnob;
  
  window.zsession.oscElements['part-balance'] = 
    new OSCKnob(document.getElementById('part-panning'));
  window.zsession.oscElements['part-balance'].setLabel("Balance");
 
  /* Section controls */ 
  //enable section back button
  document.getElementById('content-back').addEventListener('click', (e) =>{
    let backButton = document.getElementById('content-back');
    loadSection(backButton.dataset.backToPanel);
  });
 
 
  /*
   * Init note dialog
   */
  window.zsession.noteEditor = new NoteEditor();
   
  // Init volume control
  onToolbarUpdate();
  
  //Init part
  onToolbarChangePart(0);
}

function setSelectedToolbarButton(button) {
  document.querySelectorAll('#main-panel > header button.selected')
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
   
  if (sectionID.indexOf('synth') > -1)
    document.getElementById('synth-header').classList.remove('hidden');
  else
    document.getElementById('synth-header').classList.add('hidden');
}

/* Quickie to check if instrument if favorite */
function isFavorite(instrument) {
  if (instrument == null ||
      window.zsession.banks['Favorites'] === undefined ||
      window.zsession.banks['Favorites'].length == 0)
  return false;
  
  return window.zsession.banks['Favorites'].filter
          ((fav)=> {return fav.path == instrument.path})
      .length > 0;
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
    cursor = window.zsession.synthID;
  
  window.zsession.synthID = cursor;
  window.zsession.synthname = `${cursor}pars`;
  
  switch (cursor) {
    case 'ad' : {
        window.zsession.synthcursor = osc_sanitize('part/kit/synth/voice');
        window.zsession.osccursor = osc_sanitize('synthcursor/OscilSmp');
      break;
    }
    case 'sub' : {
      window.zsession.synthcursor = 
      window.zsession.osccursor =
        osc_sanitize('part/kit/synth');
      break;
    }
    case 'pad' : {
      window.zsession.synthcursor = osc_sanitize('part/kit/synth');
      window.zsession.osccursor = osc_sanitize('synthcursor/oscilgen');
      break;
    }
  }
  
 document.querySelectorAll('#synthSelector button.selected')
      .forEach ( (btn)=>btn.classList.remove('selected'));
  document.getElementById(`synth-toolbar-${zsession.synthID}-enabled`)
          .classList.add('selected');
  showIf('adsynth-voice', cursor == 'ad');
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
