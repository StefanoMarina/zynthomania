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

const ADSYNTH_GLOBAL = 127; //adsynth voice id pointing to global


 function onBanks() {
  //no more preloading banks
  
  new ZynthoREST().query('files/banks')
  .then((data) =>{
    
    let bankUI = document.getElementById('select-bank');
    bankUI.size = data.length+1;
    bankUI.options.length = 1;
 
    bankUI.options[0]
      .disabled = (window.zsession.favorites.length == 0)
      
    data.forEach ( (item) => {
      bankUI.options.add ( new Option ( item, item ) );
    });
  
    loadSection('section-select-bank');
    setSelectedToolbarButton(document.getElementById('part-toolbar-bank'));
  });
}
      
function onBanksBankSelect() {
  let selBank = document.getElementById('select-bank');
  let selection = selBank.value;
  selBank.selectedIndex = -1;
  let selectedBank = event.target.dataset.bank;
  
  
  var promise = null;
  var instruments = null;
  var favPaths = [];
  if (selection == 'favorites') {
     promise = Promise.resolve ( zsession.favorites );
  } else {
    favPaths = zsession.favorites.map ( (fav) => fav.path );
    promise = new ZynthoREST().query('files/banks/xiz', {'bank': selection});
  }
  
  promise.then ( (instruments) =>{
      console.log(instruments);
      let select = document.getElementById('select-instrument');
      select.options.length = 0;
      
      instruments.forEach ( (instr) => {
        let option = new Option ( instr.name, instr.path);
        if (selection == 'favorites' ||
          favPaths.indexOf(instr.path) > -1 ){
            option.classList.add('bookmark');
        }
        select.options.add(option);
      });
      
      select.size = select.options.length+1;
      
      document.getElementById('bankName').innerHTML= "/"+selection;
      loadSection('section-select-patch');
  });
}

function onBanksInstrumentSelect() {
  let select = document.getElementById('select-instrument');
  let instrument = select.value;
  let option = select.options[select.selectedIndex];
  select.selectedIndex = -1;
  
  select.querySelectorAll('option.selected').forEach ( e => e.classList.remove('selected'));
  
  option.classList.add('selected');
  
  new ZynthoREST().post( "loadInstrument", {'instrument': instrument, 
    'id': zsession.partID} )
   .then ( (session)=>{
      zsession.extdata = session;
      onToolbarUpdate();
  });
}

function onBind() {
  if (zsession.lastosc['osc'] == null)
    return;
  let range = zsession.lastosc.range;
  let obj = {};
  
  if (range === CC_RANGE) {
    obj['fader'] = 'abs';
  } else if (range == BOOL_RANGE) {
    obj['max'] = 64;
    obj['fader'] = 'bool';
  }else {
    obj['fader'] = (range.itype == 'i') ? 'int' : 'float';
    obj['min'] = range.min;
    obj['max'] = range.max;
  }
  
  obj['osc'] = zsession.lastosc.osc;
  loadBindEditor(obj, true);
}

function onBookmarkManager() {
    let sel = document.getElementById('system-bookmarks');
    sel.options.length = 0;
    zsession.favorites.forEach ( (book,index)=> {
      sel.options.add(new Option(book.name, index));
    });
    sel.size = sel.options.length+1;
    
    loadSection('section-bookmark-manager');
}

function onBookmarkRemove() {
  let sel = document.getElementById('system-bookmarks');
  if ( sel.selectedIndex == -1)
    return;
  
  zsession.favorites.splice(sel.selectedIndex,1);
  sel.remove(sel.selectedIndex);
  new ZynthoREST().post('favorites', {'favorites': zsession.favorites});
}

function onBookmarkTrash() {
  if (confirm ( 'Remove all bookmarks? ') ) {
    let sel = document.getElementById('system-bookmarks');
    sel.options.length = 0;
    zsession.favorites = [];
    new ZynthoREST().post('favorites', {'favorites': []});
  }
}

function onController() {
  loadSection('section-controller-main');
}

function onControllerDevices() {
  new ZynthoREST().query('/controllers').then ( (devices) =>{
    //console.log(data);
    showIf('controller-empty', devices.length == 0);
    
    if (devices.length>0) {
      var div = document.getElementById('controller-device-list');
      div.innerHTML = '';
      
      for (index in devices) {
        let toggleButton = document.createElement('button');
        toggleButton.classList.add('button','toggle');
        if (devices[index].connected)
          toggleButton.classList.add('selected');
        toggleButton.dataset.devid = devices[index].port;
        toggleButton.innerHTML = devices[index].name;
        toggleButton.addEventListener('click', onToggleButtonClick);
        toggleButton.addEventListener('click', onControllerDeviceChangeStatus);
        
        let cell = document.createElement('div');
        cell.classList.add('col-12','col-lg-6', 'panel');
        cell.append(toggleButton);
        
        div.append(cell);
      }
    }
     
    loadSection('section-controller-devices');
  });
}

function onControllerDeviceChangeStatus(event) {
  let plugRequest = event.target.classList.contains('selected');
  new ZynthoREST().post('controller/plug', {
      'name': event.target.dataset.devid,
      'status' : plugRequest
  }).then ( ()=> {
    displayOutcome( 
      ((plugRequest) ? 'Plugged ' : 'Unplugged ')
      + event.target.innerHTML
    );
  });
}

function onControllerBindings() {
  if (zsession.initBindListEditor === undefined) {
    let swipe = zsession.elements['bind-list-pointer'] =
      new Swipeable ( document.getElementById('bind-list-pointer'));
    
    swipe.setDialogData({'title':'Select Bindings', 
        'buttonClass': 'col-12 col-md-12 col-lg-6'});
        
    swipe.selectElement.addEventListener('change', (ev)=>{
      new ZynthoREST().query('status/binds', {
          'id': swipe.selectElement.value
      }).then ( (data)=> {
        zsession.bindListEditor.currentSession = data;
        selectIf('bind-editor-bypass', !data.enabled);
        loadBindMap(data.bindings);    
      })
    });
    
    /*zsession.bindListEditor = {};*/
    zsession.initBindListEditor = true;
  }
  
  new ZynthoREST().query('status/binds').then ( (data) =>{
    
    let binds = Object.keys(data);
    zsession.elements['bind-list-pointer'].setOptions(
      binds,
      binds.map ( bind => (bind.length>14)?bind.substring(0,14)+'…':bind)
    );
    
    zsession.elements['bind-list-pointer'].setValue('session');
    
    return new ZynthoREST().query('status/binds', {'id':'session'});
  }).then ((data)=>{
    console.log(data);
    zsession.bindListEditor.currentSession = data;
    selectIf('bind-editor-bypass', !data.enabled);
    loadBindMap(data.bindings);
    loadSection('section-bind-list-editor');
  });
}

function onControllerAddBinding() {
  loadBindEditor({}, true);
}

function onControllerEditBinding() {
  let path = zsession.bindListEditor.currentPath;
  
  if (path == null){
    console.log('no path!');
    return;
  }
  
  let bind = zsession.bindListEditor.currentSession
    .bindings[path[0]][path[1]];
  
  loadBindEditor(bind);
}

function onControllerRemoveBinding() {
  let path = zsession.bindListEditor.currentPath;
  
  if (path == null){
    console.log('no path!');
    return;
  }
  
  if (confirm ( 'Really delete bind?')){
    zsession.bindListEditor.currentSession
      .bindings[path[0]].splice(path[1], 1);
    zsession.bindListEditor.currentPath = null;
    ['bf-edit-del', 'bf-edit-edit'].forEach ( 
      id =>  document.getElementById(id).disabled = true);
    
    new ZynthoREST().post('setbinding', 
      { 'id' : zsession.bindListEditor.currentSession.id,
        'bindings': zsession.bindListEditor.currentSession
      }).then ( ()=> { 
        loadBindMap(zsession.bindListEditor.currentSession.bindings)
      });
  }
}

function onControllerResetList() {  
  if (confirm ( 'Really delete all bindings?')){
    zsession.bindListEditor.currentSession
      .bindings = {};
    zsession.bindListEditor.currentPath = null;
    ['bf-edit-del', 'bf-edit-edit'].forEach ( 
      id =>  document.getElementById(id).disabled = true);
    
    new ZynthoREST().post('setbinding', 
      { 'id' : zsession.bindListEditor.currentSession.id,
        'bindings': zsession.bindListEditor.currentSession
      }).then ( ()=> { 
        loadBindMap(zsession.bindListEditor.currentSession.bindings)
      });
  }
}

function onControllerBindingsLoadDialog() {
  new ZynthoREST().query('files', {'dir': 'binds'})
    .then( (files)=> {
      fileDialog('open', files, {'folder':'/binds'}, 
        onControllerBindingsLoad);
    });
}

function onControllerBindingsLoad() {
  let filename = document.getElementById('file-dialog-filename').value;
  new ZynthoREST().post('loadbind', {'file' : filename})
    .then ( ()=> {displayOutcome('Bindings succesfully loaded.')})
    .catch ( ()=> {displayOutcome('Error while loading bindings.', 
      true)});
}

function onControllerBindingsExportDialog() {
  new ZynthoREST().query('files', {'dir': 'binds'})
    .then( (files)=> {
      fileDialog('save', files, {'extension': 'json','folder':'/binds'},
        onControllerBindingsExport);
      });
}

function onControllerBindingsExport() {
  let filename = document.getElementById('file-dialog-filename').value;
          
  new ZynthoREST().post('save', { 'file' : filename, 'dir': 'binds',
      'data': zsession.bindListEditor.currentSession.bindings})
  .then ( ()=> {displayOutcome('Bindings succesfully saved.')})
  .catch ( (err)=> {displayOutcome(err,true)});
}

function onFavoriteSet() {
  let instrument = zsession.extdata.instruments[zsession.partID];
  let paths = zsession.favorites.map ( (obj) => obj.path );  
  var promise = null;
  
  if (instrument.path == null) {
    displayOutcome("I don't remember which file, sorry.", true);
    promise = Promise.resolve( 'unknown' );
  } else  if (paths.indexOf(instrument.path) > -1) {
    
      zsession.favorites.splice(paths.indexOf(instrument.path),1);
        
      promise = new ZynthoREST().post('favorites',
        {'favorites': zsession.favorites})
        .then ( ()=> {return 'remove'});
  } else {
    zsession.favorites.push(instrument);
    promise = new ZynthoREST().post('favorites',
        {'favorites': zsession.favorites})
        .then ( ()=> {return 'add'});
  }
  
  promise.then( (outcome) =>{
    updatePartMixerBookmark();
    switch (outcome){
      case 'unknown': break;
      case 'add': displayOutcome('Added new bookmark'); break;
      case 'remove': displayOutcome('Removed from bookmarks'); break;
    }
  });
}

function onFXGlobal() {
  if (zsession.initFxGlobal == undefined) {
    new OSCKnob(document.getElementById('glob-fx-0to1'));
    new OSCKnob(document.getElementById('glob-fx-0to2'));
    new OSCKnob(document.getElementById('glob-fx-0to3'));
    new OSCKnob(document.getElementById('glob-fx-1to2'));
    new OSCKnob(document.getElementById('glob-fx-1to3'));
    new OSCKnob(document.getElementById('glob-fx-2to3'));
    
    zsession.initFxGlobal = true;
  }
    new ZynthoREST().post('script', {
        'requestResult': 1, 'script': '/sysefx[0-3]/efftype'})
      .then ( (data) => {
        console.log(data);
        
        let section = document.getElementById('section-global-fx');
        
        for (let i = 0; i < 4; i++) {
          let btn = document.getElementById(`glob-fx-${i}`);
          let val = data[`/sysefx${i}/efftype`][0];
          
          btn.innerHTML = effectTypeToString(val);
          
          section.querySelectorAll(`.gfx-name${i}`).forEach ( (el) => {
            el.innerHTML = effectTypeToString(val,true);
          });
        }
        
        loadSection('section-global-fx');
    });
}

function onFXGlobalEdit(fxid) {
    zsession.fxcursor=`/sysefx${fxid}`;
    new ZynthoREST().query('status/fx', {'path': zsession.fxcursor})
      .then ( (data) => {
        loadFXEditor(data, `Edit Glob FX #${fxid}`, 'section-global-fx');
        document.querySelector('#fx-type select')
          .addEventListener('change', onFXGlobalEditFxChanged);
        
        zsession.oscElements['fx-part-bypass'].setEnabled(false);
        zsession.oscElements['fx-part-bypass']
          .HTMLElement.parentNode.classList.add('hidden');
    });
}

function onFXGlobalEditFxChanged(event) {
  let changed = event.target.options[event.target.selectedIndex].text;
  let fxid = /\d+$/.exec(zsession.fxcursor)[0];
  document.getElementById(`glob-fx-${fxid}`).innerHTML = changed;
}

/**
 * SYSTEM / SESSION
 */
 
function onSessionNew() {
  if (!confirm('This will reset session file and any unsaved will be lost!\n'
    + ' Continue?')) {
      return;
  }
  
  new ZynthoREST().post('session/reset').then ( ()=> {
    return onToolbarUpdate();
  }).then( ()=> {
    onToolbarChangePart();
    loadSection('section-intro');
  }) ;
}

function onSessionLoad() {
  new ZynthoREST().query('files', {'dir': 'sessions'})
    .then( (files)=> {
      //session files only
      files = files.filter ( f => f.endsWith('xmz') ); 
      fileDialog('open', files, {'folder':'/sessions'}, 
        onSessionFileLoad);
    });
}

function onSessionFileLoad() {
  let file = document.getElementById('file-dialog-filename').value;
  new ZynthoREST().post('session/load', {'file': file})
    .then ( ()=>{ 
      onToolbarUpdate();
    });
}

function onSessionSave() {
  new ZynthoREST().post('session/save')
    .then ( ()=> {
      displayOutcome ('Session saved.');
    });
}

function onSessionSaveAs() {
  new ZynthoREST().query('files', {'dir': 'sessions'})
    .then( (files)=> {
      //session files only
      files = files.filter ( f => f.endsWith('xmz') ); 
      fileDialog('save', files, {'folder':'/sessions',
          'extension': 'xmz'}, 
        onSessionFileSaveAs);
    });
}

function onSessionFileSaveAs() {
  let file = document.getElementById('file-dialog-filename').value;
  
  new ZynthoREST().post('session/save', {'file': file})
    .then ( ()=>{ 
      onToolbarUpdate();
    });
}

/**
 * SYNTH SECTION
 */
 
function onSynthToolbarUpdate() {
  zsession.layerID = document.querySelector('#synth-layer select')
    .selectedIndex;
  
  //console.log("Updating synth toolbar");
  
  zsession.oscElements['bundle-synth-toolbar'].sync()
    .then ( (data) => {
      //console.log(data);
      result = osc_map_to_control(data);
      zsession.oscElements['synth-toolbar-layer-enabled']
        .setValue(result['Penabled']);
      
      showIf('synth-toolbar-ad-enabled', result['Padenabled'], 'gray');
      showIf('synth-toolbar-sub-enabled', result['Psubenabled'], 'gray');
      showIf('synth-toolbar-pad-enabled', result['Ppadenabled'], 'gray'); 
      
      zsession.elements['adsynth-voice'].setSelection(zsession.voiceID);
  });
}

function onSynthToolbarVoiceUpdate(event) {
  zsession.voiceID = 
    event.target.options[event.target.selectedIndex].value;
    
  set_synth_cursor();
  
  //update synth page regardless of position
  showIf('voice-matrix', zsession.voiceID != ADSYNTH_GLOBAL);
 
  
  //reload the section or return to main synth
  let currentActiveSection = document.querySelector('#section-content section.opened');
  
  //Adsynth Oscillator not availale in global
  if (currentActiveSection.id == 'section-synth-osc'
   && zsession.voiceID == ADSYNTH_GLOBAL){
     onSynth();
  } else {
    zsession.reloadSynthSubSection();
  }
}

function onSynthEnableSync(event) {
  let value = (event.type == 'sync') 
    ? Object.values(event.detail)[0][0]
    : event.detail.script.endsWith('T');
    
  //console.log(`Call: ${event.type}, ${value}`);
  let id= `synth-toolbar-${zsession.synthID}-enabled`;
  showIf(id, value, 'gray');
}

function onSynth(synth) {
  initSynthToolbar();
  setSelectedToolbarButton(document.getElementById('part-toolbar-synth'));
   
  //refresh synth cursor
  set_synth_cursor(synth);
  if (synth == undefined)
    synth = zsession.synthID;
  
  zsession.reloadSynthSubSection = onSynth;
  switch (synth) {
    case 'sub' : onSynthSubsynth(); break;
    case 'ad' : onSynthAdsynth(); break;
    case 'pad': onSynthPadsynth(); break;
    default: break;
  }
  
  onSynthToolbarUpdate();
}

function onSynthAdsynth() {
  if (zsession.initAdSynth === undefined) {
    let obj = new OSCBoolean(document.getElementById('adsynth-enabled'));
    
    obj.HTMLElement.addEventListener('sync', onSynthEnableSync);
    obj.HTMLElement.addEventListener('act', onSynthEnableSync);
    
    new OSCPathElement(document.getElementById('adsynth-vco-env-enable'),
      null,onSynthFrequencyEnvelope);
    new OSCPathElement(document.getElementById('adsynth-vco-lfo-enable'),
      null,onSynthFrequencyLFO);
      
    obj = new OSCPathElement(document.getElementById('adsynth-vcf-enable'),
      null,onSynthFilter);
    
    new OSCPathElement(document.getElementById('adsynth-vcf-env-enable'),
      null,onSynthFilterEnvelope);
    new OSCPathElement(document.getElementById('adsynth-vcf-lfo-enable'),
      null,onSynthFilterLFO);
    
    obj.bindEnable('adsynth-vcf-env-enable',
    'adsynth-vcf-lfo-enable');
    
    new OSCPathElement(document.getElementById('adsynth-vca-env-enable'),
      null,onSynthAmplitudeEnvelope);
    new OSCPathElement(document.getElementById('adsynth-vca-lfo-enable'),
      null,onSynthAmplitudeLFO);
    
    new OSCPathElement(document.getElementById('adsynth-voice-enable'),
      null,onSynthOSC);
    
    
    zsession.initAdSynth = true;
 }
 
 set_synth_cursor('ad');
 
 if ( zsession.voiceID != ADSYNTH_GLOBAL)
  document.getElementById('adsynth-voice-enable')
    .innerHTML = 'Voice ' + String((zsession.voiceID+1)).padStart(2,0);
  
 let voiceControls = Array.from(document.getElementById('voice-matrix')
    .querySelectorAll('.osc-element')).map ( (el)=> el.id );
 
 showIf('voice-matrix', zsession.voiceID != ADSYNTH_GLOBAL);
 
 let params = (zsession.voiceID != ADSYNTH_GLOBAL) 
  ? voiceControls : '';
  
 
 osc_synch(...params).then ( ()=> {
   loadSection('section-synth-adsynth');
   zsession.reloadSynthSubSection = onSynthAdsynth;
  });
}

function onSynthSubsynth() {
  if (window.initSubSynth === undefined) {
    new OSCPathElement(
      document.getElementById('subsynth-vco-env-enable'),null,
      onSynthFrequencyEnvelope);
    
    new OSCPathElement(
      document.getElementById('subsynth-vcf-enable'),null,
      onSynthFilter);
    
    let obj = new OSCBoolean(document.getElementById('subsynth-enabled'));
    
    obj.HTMLElement.addEventListener('act', (event)=>{
      
      let value = event.detail.script.endsWith('T');
      
      //console.log(`Call: ${event.type}, ${value}`);
      
      showIf('synth-subsynth-enable-before', !value );
      showIf('synth-subsynth-matrix', value );
      
      if (value){
        Promise.resolve( osc_synch_section(
          document.getElementById('section-synth-subsynth')
        ))
      }
    });
    
    obj.HTMLElement.addEventListener('sync', onSynthEnableSync);
    obj.HTMLElement.addEventListener('act', onSynthEnableSync);
    

    window.initSubSynth = true;
  }
  
  set_synth_cursor('sub');
  zsession.oscElements['subsynth-enabled'].sync().then( (data)=> {
    let value = Object.values(data)[0][0];
    showIf('synth-subsynth-enable-before', !value);
    showIf('synth-subsynth-matrix', value);
    
    return (value)
      ? osc_synch_section(document.getElementById('section-synth-subsynth'))
      : Promise.resolve(false);
  }).then ( ()=> {
      loadSection('section-synth-subsynth');
      zsession.reloadSynthSubSection = onSynthSubsynth;
  });
}

function onSynthPadsynth() {
   if (zsession.initPadsynth === undefined) {
     let obj = new OSCBoolean(document.getElementById('padsynth-enabled'));
    
    obj.HTMLElement.addEventListener('sync', onSynthEnableSync);
    obj.HTMLElement.addEventListener('act', onSynthEnableSync);
     zsession.initPadsynth = true;
   }
   
   set_synth_cursor('pad');
   zsession.oscElements['padsynth-enabled'].sync().then ( ()=> {
     loadSection('section-synth-padsynth');
     zsession.reloadSynthSubSection = onSynthPadsynth;
   });
}

function onSynthOSC() {
  if (zsession.initSynthOSC === undefined) {
    
    /* synth-osc-wave is a representation of an OSC bundle actually */
    let swipe = new Swipeable(document.getElementById('synth-osc-wave'));
    swipe.setOptions( [...Array(16).keys(),17,18],
      ['Sine','Triangle','Pulse','Saw','Power','Gauss','Diode','AbsSine',
        'PulseSine','StretchSine', 'Chirp', 'AbsStrSine', 'Chebyshev',
        'Square','Spike','Circle','White noise','Pink noise']
    );
    swipe.setDialogData({ 'title' : 'Select base wave', 'buttonClass': 'col-6 col-lg-4'});
    
    swipe.selectElement.addEventListener('change', (ev) => {
      let value = ev.target.options[ev.target.selectedIndex].value;
      let typeValue = Math.max(0, value - 16);
      zsession.oscElements['synth-generator-type'].act (typeValue);
      
      if (typeValue == 0)
        zsession.oscElements['synth-generator-wave'].act(value);
    });
  
    zsession.elements['synth-osc-wave'] = swipe;
    
    new OSCElement(document.getElementById('synth-generator-type'));
    new OSCElement(document.getElementById('synth-generator-wave'));
    new OSCKnob(document.getElementById('synth-osc-wave-p'),
      undefined, BALANCE);
    
    new OSCSwipeable(document.getElementById('synth-osc-shaper'),
      [...Array(18).keys()],
      ['None', 'Arc Tang.', 'Asymmetric', 'Pow', 'Sine', 'Quantis.', 'Zigzag',
        'Limiter', 'Up Limit', 'Low limit', 'Inverse Lim.', 'Clip', 'Asym2', 'Pow2', 'Sigmoid',
        'TanH','Cubic','Square' ],
      { 'title': 'Select shaper', 'buttonClass': 'col-6 col-lg-4'}
      );
    new OSCKnob(document.getElementById('synth-osc-shaper-p'));
      
    new OSCSwipeable(document.getElementById('synth-osc-h'),
      [...Array(9).keys()],
      ['Off', 'On', 'Square', '2xSub','2xAdd', '3xSub', '3xAdd',
        '4xSub', '4xAdd'],
      { 'title': 'Select harmonics', 'buttonClass': 'col-4 col-lg-3'}
      );
    new OSCKnob(document.getElementById('synth-osc-h-f'),undefined,
      {'type': 'Harmonic frequency', 'min' : 0, 'max' : 255, 'itype': 'i'} );
    new OSCKnob(document.getElementById('synth-osc-h-p'),undefined,
      {'type': 'Harmonic power', 'min' :0, 'max' : 200, 'itype': 'i'} );
    
    
    new OSCSwipeable(document.getElementById('synth-osc-fm'),
     [...Array(6).keys()],
     ['Off','Morph','Ring', 'PM', 'FM', 'PWM'],
     {'title': 'Frequency Mod Type', 'buttonClass': 'col-12'}
    );
    
    
    //Unison
    new OSCKnob(document.getElementById('synth-uni-size'), undefined,
      {'min':1,'max':50, 'type': '# of voices'});
      
    let osc = new OSCKnob(document.getElementById('synth-uni-spread'), undefined,
      {'min':0,'max':200, 'type': '%', 'itype': 'f'});
    osc.serverRange = CC_RANGE;
    
    new OSCKnob(document.getElementById('synth-uni-phase'));
    new OSCKnob(document.getElementById('synth-uni-vib'));
    new OSCKnob(document.getElementById('synth-uni-speed'));
    
    zsession.initSynthOSC = true;
  }
  
  var bChangedPart = false;
  if (zsession.voiceID == ADSYNTH_GLOBAL) {
    zsession.voiceID = 0;
    zsession.elements['adsynth-voice'].setSelection(1);
    
    bChangedPart = true; //setting for later as sync clears msg
  }
  
  osc_synch_section(document.getElementById('section-synth-osc')). then ( () => {
    
    //Synch complex swiper
    let val = parseInt(zsession.oscElements['synth-generator-type']
      .HTMLElement.dataset.value);
    if (val > 0) {
      zsession.elements['synth-osc-wave'].setSelection(val+16);
   
      Array.from( document.querySelectorAll('#section-synth-osc .osc-element'))
        .map ( (el) => el.id)
        .forEach ( (id) => {zsession.oscElements[id].setEnabled(false)});
    } else {
      zsession.elements['synth-osc-wave'].setSelection(
        zsession.oscElements['synth-generator-wave']
          .HTMLElement.dataset.oscValue );
      Array.from( document.querySelectorAll('#section-synth-osc .osc-element'))
        .map ( (el) => el.id)
        .forEach ( (id) => {zsession.oscElements[id].setEnabled(true)});
    }
    
    zsession.onChangeSynth=onSynth;
    zsession.reloadSynthSubSection = onSynthOSC;
    
    if (bChangedPart)
      displayOutcome('Switching to adsynth voice #1');
      
    loadSection('section-synth-osc');
  });
}

function onSynthAmplitude(event) {
  zsession.reloadSynthSubSection = onSynthAmplitude;
  
  let forceGlobal = (typeof event == 'object') ? false : event;
  
  if (forceGlobal)
    zsession.elements['adsynth-voice'].setSelection(0,true);
    
  loadAmplitudeEditor('VCA', 
  (window.zsession.synthID != 'sub') ? onSynthAmplitudeLFO : null,
    onSynthAmplitudeEnvelope);
}

function onSynthAmplitudeLFO() {
  zsession.reloadSynthSubSection = onSynthAmplitudeLFO;
  
  let sc = osc_sanitize('/synthcursor/AmpLfo');
  
  let enable = (zsession.voiceID == ADSYNTH_GLOBAL)
    ? null 
    : osc_sanitize('/synthcursor/PAmpLfoEnabled');
    
  loadLFOEditor(  enable, sc);
}

function onSynthAmplitudeEnvelope() {
  zsession.reloadSynthSubSection = onSynthAmplitudeEnvelope;
  
  let sc = osc_sanitize('/synthcursor/AmpEnvelope');
  
  let enable = (zsession.voiceID == ADSYNTH_GLOBAL)
    ? null 
    : osc_sanitize('/synthcursor/PAmpEnvelopeEnabled');
    
  loadEnvelopeEditor('Amp Envelope', 
   enable, sc,
   [1,1,1,0,0,1,0]
   );
}

function onSynthFilter(event) {
  zsession.reloadSynthSubSection = onSynthFilter;
  
  let forceGlobal = (typeof event == 'object') ? false : event;
    
  if (forceGlobal)
    zsession.elements['adsynth-voice'].setSelection(0,true);
    
  let sc, enable;
  
  if (zsession.voiceID == ADSYNTH_GLOBAL || zsession.synthID != 'ad'){
    enable = null;
    sc = osc_sanitize('/synthcursor/GlobalFilter');
  } else {
    enable = osc_sanitize('/synthcursor/PFilterEnabled');
    sc = osc_sanitize('/synthcursor/VoiceFilter');
  }
    
  loadFilterEditor('VCF', 
    enable, sc, 
    (window.zsession.synthID != 'sub') ? onSynthFilterLFO : null
    , onSynthFilterEnvelope);
}

function onSynthFilterLFO() {
  zsession.reloadSynthSubSection = onSynthFilterLFO;
  
  let sc = osc_sanitize('/synthcursor/FilterLfo');
  
  let enable = (zsession.voiceID == ADSYNTH_GLOBAL)
    ? null 
    : osc_sanitize('/synthcursor/PFilterLfoEnabled');
    
  loadLFOEditor( enable, sc);
}

function onSynthFilterEnvelope() {
  zsession.reloadSynthSubSection = onSynthFilterEnvelope;
  
  let sc = osc_sanitize('/synthcursor/FilterEnvelope');
  
  let enable = (zsession.voiceID == ADSYNTH_GLOBAL)
    ? null : osc_sanitize('/synthcursor/PFilterEnvelopeEnabled');
    
  loadEnvelopeEditor(
  'Filter Envelope', 
  enable, sc,
  [1,1,1,1,1,0,1]
  );
}

function onSynthFrequency(event) {
  zsession.reloadSynthSubSection = onSynthFrequency;
  
  let forceGlobal = (typeof event == 'object') ? false : event;
  
  if (forceGlobal)
    zsession.elements['adsynth-voice'].setSelection(0,true);
  
  let sc = osc_sanitize('/synthcursor');
  
  loadFrequencyEditor('VCO', '', sc,
    (window.zsession.synthID != 'sub') ? onSynthFrequencyLFO : null, 
    onSynthFrequencyEnvelope);
}

function onSynthFrequencyLFO() {
  zsession.reloadSynthSubSection = onSynthFrequencyLFO;
  
  let sc = osc_sanitize('/synthcursor/FreqLfo');
  
  let enable = (zsession.voiceID == ADSYNTH_GLOBAL)
    ? null 
    : osc_sanitize('/synthcursor/PFreqLfoEnabled');
    
  loadLFOEditor( enable, sc);
}

function onSynthFrequencyEnvelope() {
  zsession.reloadSynthSubSection = onSynthFrequencyEnvelope;
  
  let sc = osc_sanitize('/synthcursor/FreqEnvelope');
  
  let enable = (zsession.voiceID == ADSYNTH_GLOBAL)
    ? null : osc_sanitize('/synthcursor/PFreqEnvelopeEnabled');
    
  loadEnvelopeEditor(
  'Wave Frequency Env.', 
  enable, sc,
  [1,0,1,1,0,0,1]
  );
}

function onSynthFMFrequency() {
  zsession.reloadSynthSubSection = onSynthFMFrequency;
  
  let sc = osc_sanitize('/synthcursor');
  
  loadFrequencyEditor('FM Frequency',  'FM', sc,
    null, onSynthFMFrequencyEnvelope);
}

function onSynthFMFrequencyEnvelope() {
  zsession.reloadSynthSubSection = onSynthFMFrequencyEnvelope;
  
  let sc = osc_sanitize('/synthcursor')+'/FMAmpEnvelope';
  loadEnvelopeEditor('FM Frequency Env', 
    osc_sanitize('/synthcursor/PFMAmpEnvelopeEnabled'),
    sc,
    [1,0,1,1,0,0,1]
  );     
}

function onSynthSubMagnitude() {
  if (zsession.initSubH === undefined){
    new OSCButton(document.getElementById('sub-h-clear'));
    
    new OSCSwipeable(document.getElementById('sub-h-mag-type'),
    [0,1,2,3,4],
    ['Linear', '-40 Db', '-60 Db', '-80 Db', '-100 Dd'],
    {'title' :'Magnitude type', 'buttonClass': 'col-4 col-lg-2'}
    );
    
    new OSCSwipeable(document.getElementById('sub-h-spread-type'),
    [...Array(8).keys()],
    ['Harmonic', 'Shift U', 'Shift L', 'Power U', 'Power L', 'Sine', 'Power', 'Shift'],
    {'title' :'Spread type', 'buttonClass': 'col-6 col-lg-4'}
    );
    
    new OSCKnob(document.getElementById('sub-h-stages'),
      null, {'min': 1, 'max': 5, 'type': 'Stages', 'itype': 'i'});
        
    for (let i = 1; i < 4; i++) {
      let obj = new OSCKnob(document.getElementById(`sub-h-spread-${i}`));
      obj.label="Parameter " + i;
    }
    
    
    //Magnitude faders
    let swipe = zsession.elements['magnitude-selector'] =
      new Swipeable ( document.getElementById('magnitude-selector') );
    
    swipe.setOptions (
      [...Array(4).keys()],
      ['Harms 1-8', 'Harms 9-16', 'Harms 17-24', 'Harms 25-32']
    );
    swipe.setDialogData({'title': 'section', 'buttonClass': 'col-12'});
    
    swipe.selectElement.addEventListener('change', ()=>{
        let pages = Array.from(document.getElementById('section-synth-harmonics')
          .querySelectorAll('.mag-sec-page'));
        let page = pages[swipe.selectElement.selectedIndex];
        pages.filter ( p => p != page).
          forEach ( (pg) => pg.classList.add('d-none'));
          
        page.classList.remove('d-none');
    });
    
    let faders = document.getElementById('section-synth-harmonics')
      .querySelectorAll('input[type=range]');
    
    for (let i = 0; i < 32; i++) {
      let id = `magnitude-ph-${i}`;
      faders[i].id = id;
      faders[i].dataset.oscPath = `/synthcursor/Phmag${i}`;
      new OSCFader(faders[i], CC_RANGE);//.oscpath=`/synthcursor/Phmag${i}`;
    }
    
    //clear btn
    zsession.oscElements['sub-h-clear'].HTMLElement
      .addEventListener('act', ()=> {
        document.getElementById('section-synth-harmonics')
          .querySelectorAll('input[type=range]')
          .forEach ( (el) => el.value = 0);
    });
    
    zsession.initSubH = true;
  }
  
  osc_synch_section(document.getElementById('section-synth-harmonics'))
    .then ( () => {
      loadSection ('section-synth-harmonics');
    });
}

function onSynthSubBandwidth() {
   if (zsession.initSubB === undefined){
     new OSCSwipeable(document.getElementById('sub-band-init'),
     [0,1,2],
     ['Zero', 'Rand', 'Ones']);
     
     new OSCKnob(document.getElementById('sub-band-band'));
     new OSCKnob(document.getElementById('sub-band-stretch'));
     new OSCButton(document.getElementById('sub-bw-clear'));
     
      let swipe = zsession.elements['bw-selector'] =
      new Swipeable ( document.getElementById('bw-selector') );
    
    swipe.setOptions (
      [...Array(4).keys()],
      ['RelBW 1-8', 'RelBW 9-16', 'RelBW 17-24', 'RelBW 25-32']
    );
    swipe.setDialogData({'title': 'section', 'buttonClass': 'col-12'});
    
    swipe.selectElement.addEventListener('change', ()=>{
        let pages = Array.from(document.getElementById('subsynth-bandwidth')
          .querySelectorAll('.bw-sec-page'));
        let page = pages[swipe.selectElement.selectedIndex];
        pages.filter ( p => p != page).
          forEach ( (pg) => pg.classList.add('d-none'));
          
        page.classList.remove('d-none');
    });
    
    let faders = document.getElementById('subsynth-bandwidth')
      .querySelectorAll('input[type=range]');
    
    for (let i = 0; i < 32; i++) {
      let id = `bw-ph-${i}`;
      faders[i].id = id;
      faders[i].dataset.oscPath = `/synthcursor/Phrelbw${i}`;
      new OSCFader(faders[i], CC_RANGE);//.oscpath=`/synthcursor/Phmag${i}`;
    }
    //clear btn
    zsession.oscElements['sub-bw-clear'].HTMLElement
      .addEventListener('act', ()=> {
        document.getElementById('subsynth-bandwidth')
          .querySelectorAll('input[type=range]')
          .forEach ( (el) => el.value = 64);
    });
    
     zsession.initSubB = true;
   }
   
   osc_synch_section(document.getElementById('subsynth-bandwidth'))
    .then ( ()=> {
      loadSection('subsynth-bandwidth');
    });
}

function onNetwork() {
  new ZynthoREST().query('system/network')
    .then ( (data) =>{
    zsession.hotspotMode = data.isHotSpot !== undefined;
    if (zsession.hotspotMode)
      document.getElementById('network-hotspot')
        .innerHTML = "Restore local wifi";
    else
      document.getElementById('network-hotspot')
        .innerHTML = "Enable hotspot";
    
    loadSection('section-system-network');
  });
}


function onNetworkChange() {
  
  if (confirm ('Switch between Hotspot and local wifi?')){
    let val = !zsession.hotspotMode;
    new ZynthoREST.post('network-change',
        {toHotspot : val}, (data) => {
          document.getElementByTagName('body')[0]
            .innerHTML = '<small>Please change address bar to match the new connection</small>';
    });
  }
}


function onSystem() {
  loadSection('section-system');
  setSelectedToolbarButton('main-toolbar-system');
}

function onSystemInfo() {
  new ZynthoREST().query('system/info')
    .then ( (data) =>{
      let section = document.getElementById('section-system-info');
      section.innerHTML = 
      `<p><b>RAM: </b> ${data.memory}</p>`
    + `<p><b>CPU temp: </b> ${data.cpuTemp}</p>`
      ;
      loadSection('section-system-info');
    });
}


function onSystemModulesReconnect() {
  if (!confirm ('reconnect to zynddsubfx?'))
    return;
    
  let zyn = document.getElementById('module-zyn-status');
  zyn.classList.remove('fa-toggle-on', 'fa-toggle-off');
      
  new ZynthoREST().post('reconnect')
    .then ( (data) => {
    zyn.classList.add('fa-toggle-on');
  }).catch ( (err)=>{
    zyn.classList.add('fa-toggle-off');
  });
  
  doAction('reconnect', (data) => {
    displayMessage('Reconnected!');
    let icon = $('#pnlSystemInfo > div:first-child').find('p > i');
    icon.removeClass('fa-times-circle');
    icon.addClass('fa-check-circle');
  });
}

function onSystemModules() {
 
  new ZynthoREST().query('system/modules').then ( (data) =>{
    
    let zyn = document.getElementById('module-zyn-status');
    zyn.classList.remove('fa-toggle-on', 'fa-toggle-off');
    zyn.classList.add( ( data.zynProcess != 'NA') 
         ? 'fa-toggle-on' : 'fa-toggle-off');
    let jack = document.getElementById('module-jack-status');
    jack.classList.remove('fa-toggle-on', 'fa-toggle-off');
    jack.classList.add( ( data.jackProcess != 'NA') 
         ? 'fa-toggle-on' : 'fa-toggle-off');
         
    loadSection('section-system-modules');
  });
}

function onSystemShutdown(reboot) {
  
  let msg = (!reboot)
    ? 'Save and shut down system?'
    : 'Save and reboot?'
  
  if (!confirm(msg))
    return;
  
   window.location.href =
     window.location.href.replace(/\/$/,'')
     + '/shutdown' + ((reboot) ? '?reboot=yes' : '');
}

function onPartInstrumentSave(backTo) {
  let section = document.getElementById('section-save-instrument');
  section.dataset.back = backTo;
  
  new ZynthoREST().query('files/banks', null).then((data) =>{
    let select = document.getElementById('save-instrument-bank-folder');
    select.innerHTML = '';
    data.forEach ( (dir) => select.options.add(new Option(dir, dir)));
    
    return new ZynthoREST().post('script', 
      { 'requestResult': 1,
        'script': [
          osc_sanitize('/part/Pname'),
          osc_sanitize('/part/info.Pauthor') 
        ]
      }
    );
  }).then ( (data)=> {
    document.getElementById('save-instrument-name')
      .value = data[osc_sanitize('/part/Pname')][0];
    document.getElementById('save-instrument-author')
      .value = data[osc_sanitize('/part/info.Pauthor')][0];
      
    if (!isNaN(zsession.lastLoadedInstrument[zsession.partID]))
      document.getElementById('save-instrument-program')
        .value = zsession.lastLoadedInstrument[zsession.partID];
    else
      document.getElementById('save-instrument-program').value = -1;
      
    loadSection('section-save-instrument');
  });
}

function onPartInstrumentSaveClick() {
  let folder = 
    document.getElementById('save-instrument-bank-folder').value;
  
   new ZynthoREST().query('files/banks/xiz', {'bank': folder} )
    .then( (data)=> {
      let rex = /.*\/(.+)$/;
      let files = data.map ( (d) => rex.exec(d.path)[1]);
      
      fileDialog('save', files, {'folder':`/${folder}`}, 
        onPartInstrumentSaveOk);
      
      document.getElementById('file-dialog-filename').value =
        document.getElementById('save-instrument-name').value
        .replace(/[ :,\/]+/, '_')
        .concat('.xiz');
    });   
}

function onPartInstrumentSaveOk() {
  let file = document.getElementById('file-dialog-filename').value;
  if ( file == '' ) throw 'Empty file';
  
  if (!file.endsWith('xiz'))
    file = file + '.xiz';
    
  new ZynthoREST().post('save_xiz',
    {
      'program' : document.getElementById('save-instrument-program').value,
      'bank' : document.getElementById('save-instrument-bank-folder').value,
      'partID' : zsession.partID,
      'file' : file,
      'name' : document.getElementById('save-instrument-name').value,
      'author': document.getElementById('save-instrument-author').value
    }
  ).then ( (msg)=>{
      displayOutcome(msg);
  })
}

function onPartMixer() {
  if (zsession.initPartMixer === undefined) {
    zsession.oscElements['part-enable'] =
      new OSCBoolean(document.getElementById('part-enable'));
    zsession.oscElements['part-enable'].setLabel('Enable');
    
    let volumeKnob = new OSCKnob(document.getElementById('part-volume'));
    volumeKnob.setLabel('Volume');
    zsession.oscElements['part-volume'] = volumeKnob;
    
    zsession.oscElements['part-balance'] = 
      new OSCKnob(document.getElementById('part-panning'));
    zsession.oscElements['part-balance'].setLabel("Balance");
    
    zsession.initPartMixer = true;
  }
  
  osc_synch_section(document.getElementById('section-part-main'))
  .then ( ()=> {
    updatePartMixerBookmark();
    loadSection('section-part-main');
    setSelectedToolbarButton(document.querySelector('#partToolbar > button:nth-child(1)'));
  });
}

function updatePartMixerBookmark() {
    //check bookmark status
    let instrument = zsession.extdata.instruments[zsession.partID];
    let icon = document.getElementById('part-favorite');

    if (instrument.name != null && instrument.path == null){ //bad status
      icon.classList.remove('far', 'fa', 'fa-bookmark');
      icon.classList.add('fas', 'fa-question');
    } else if (zsession.favorites.map ( (obj)=>obj.path )
      .indexOf( instrument.path ) > -1) {
      icon.classList.remove('far', 'fa-question');
      icon.classList.add('fa', 'fa-bookmark');
    } else {
      icon.classList.remove('fa', 'fa-question');
      icon.classList.add('far', 'fa-bookmark');
    }
}

function onManagerNewBank() {
  
}

function onMixer() {
  if (zsession.initMixer === undefined) {
    let bundleArray = [];
    
    for (let i = 0; i < 16; i++) {
      new OSCBoolean(document.getElementById(`mixer-part-${i+1}-enabled`));
      new OSCKnob(document.getElementById(`mixer-part-${i+1}-volume`))
      new OSCKnob(document.getElementById(`mixer-part-${i+1}-pan`))
      bundleArray.push(`/part${i}/Pname`);
    }
    zsession.oscElements['bundle-mixer-names'] = new OSCBundle(bundleArray);
    
    zsession.initMixer = true;
  }
  osc_synch_section(document.getElementById('section-mixer'))
    .then ( ()=>{
        return zsession.oscElements['bundle-mixer-names'].sync();
   }).then ( (data)=>{
        
        for (let i = 1; i < 17; i++){
          document.getElementById(`mixer-part-${i}-name`).innerHTML =
            (`${i}. `+data[`/part${i-1}/Pname`][0]);
        }
        loadSection('section-mixer');
    });
}
function onPartControl() {
  
  // Init controls
  if (zsession.initControl === undefined) {
     new OSCSwipeable(
      document.getElementById('part-ctl-channel'),
      OneToSixteen.map ( (e)=> e-1), 
      OneToSixteen.map( (val, index, arr) => 
        {return "#"+String(index+1).padStart(2,'0');} ),
      { 'title' : 'Channel', 'class' : 'col-4' }
    );
    
    //zsession.oscElements['part-ctl-channel'].setLabel('Midi channel', 'Midi');
    
      new OSCMidiNote( document.getElementById('part-ctl-minkey') );
      new OSCMidiNote( document.getElementById('part-ctl-maxkey') );
      new OSCKnob( document.getElementById('part-ctl-transpose') )
        .range = SEMITONE;
      
    zsession.initControl = true;
  }
  
  //synch osc
  osc_synch_section(document.getElementById('section-part-control'))
    .then ( () => {
    //enable section
    loadSection('section-part-control');
    setSelectedToolbarButton(
      document.querySelector('#partToolbar .i-piano')
      .parentElement);
  });
}

function onPartControlPoly() {
  if (zsession.initControlPoly === undefined) {
    new OSCSwipeable(
      document.getElementById('part-ctl-polytype'),
      [0,1,2], 
      ['Poly', 'Mono', 'Legato'],
      { 'title' : 'Poly mode', 'class' : 'col-12' }
    );
    zsession.oscElements['part-ctl-polytype']
      .setLabel('Polyphony mode', 'Polyphony');
      
    
      new OSCKnob(document.getElementById('part-ctl-keylimit'));
    zsession.initControlPoly = true;
  }
  
  osc_synch_section(document.getElementById('section-ctl-poly'))
    .then ( () => {
    //enable section
    loadSection('section-ctl-poly');
  });
}

function onPartControlVelo() {
  if (zsession.initControlVelo === undefined) {
      new OSCKnob(document.getElementById('part-ctl-velsns'));
      new OSCKnob(document.getElementById('part-ctl-veloffs'));
    zsession.initControlVelo = true;
  }
  
  osc_synch_section(document.getElementById('section-ctl-velocity'))
    .then ( () => {
    //enable section
    loadSection('section-ctl-velocity');
  });
}

function onPartControlDepth() {
  if (zsession.initControlDepth === undefined) {  
    new OSCKnob(document.getElementById('part-ctl-depth-pan'));
    new OSCKnob(document.getElementById('part-ctl-depth-cutoff'));
    new OSCKnob(document.getElementById('part-ctl-depth-q'));
    new OSCKnob(document.getElementById('part-ctl-depth-modwheel'));
    new OSCBoolean(document.getElementById('part-ctl-modwheel-exponential'));
    new OSCBoolean(document.getElementById('part-ctl-bandwidth-exponential'));
    new OSCKnob(document.getElementById('part-ctl-depth-bandwidth'));
    new OSCBoolean(document.getElementById('part-ctl-expression-receive'));
    new OSCBoolean(document.getElementById('part-ctl-volume-receive'));
    new OSCBoolean(document.getElementById('part-ctl-fmamp-receive'));
    new OSCBoolean(document.getElementById('part-ctl-sustain-receive'));
    zsession.initControlDepth = true;
  }
  osc_synch_section(document.getElementById('section-part-control-response'))
    .then ( () => { loadSection('section-part-control-response');
  });
}

function onPartControlPitch() {
  if (zsession.initControlPitch === undefined) {  
    
    new OSCKnob(document.getElementById('part-ctl-pitch-range'));
    zsession.oscElements['part-ctl-pitch-range']
      .range = BEND_RANGE;
      
    new OSCBoolean(document.getElementById('part-ctl-pitch-split'));
    
    new OSCKnob(document.getElementById('part-ctl-pitch-range-down'));
      zsession.oscElements['part-ctl-pitch-range-down']
        .range = BEND_RANGE;
    
    zsession.oscElements['part-ctl-pitch-split']
      .bindEnable('part-ctl-pitch-range-down');
    zsession.initControlPitch = true;
  }
  
  osc_synch_section(document.getElementById('section-part-control-pitch'))
    .then ( () => {
      loadSection('section-part-control-pitch');
  });
}

function onPartControlPortamento() {
  if (zsession.initPartControlPortamento === undefined) {
    new OSCBoolean(document.getElementById('part-ctl-port-enable'));
    new OSCBoolean(document.getElementById('part-ctl-port-receive'));
    new OSCKnob(document.getElementById('part-ctl-port-length'));
    new OSCKnob(document.getElementById('part-ctl-port-updown'));
    
    new OSCBoolean(document.getElementById('part-ctl-port-proportional'));
    new OSCKnob(document.getElementById('part-ctl-port-proprate'));
    new OSCKnob(document.getElementById('part-ctl-port-propdepth'));
    
    zsession.oscElements['part-ctl-port-proportional']
      .bindEnable( 'part-ctl-port-proprate', 'part-ctl-port-propdepth' );
    
    new OSCSwipeable(document.getElementById('part-ctl-port-pitchtype'),
      ['F', 'T'],
      ['Include','Exclude'],
      {'title': 'Threshold behaviour'}
      );
    //new OSCBoolean(document.getElementById('part-ctl-port-pitchtype'));
    new OSCKnob(document.getElementById('part-ctl-port-pitchthresh'));
    zsession.initPartControlPortamento = true;
    
    zsession.oscElements['part-ctl-port-enable'].bindEnable(
      'part-ctl-port-length', 'part-ctl-port-updown',
      'part-ctl-port-proportional', 'part-ctl-port-pitchtype',
      'part-ctl-port-pitchthresh');
  }
  
  osc_synch_section(document.getElementById('section-part-control-portamento'))
    .then ( () => {
      loadSection('section-part-control-portamento');
  });
}

function onPartFX() {
  if (zsession.initPartFX == undefined){
    
      //initialize send to global
      for (let i = 0; i < 4; i++)
        new OSCKnob(document.getElementById(`part-fx-send-${i}`));
    
      //Initialize route matrix
      let entries = [0,1,2];
      let labels = ['Next', 'Part out', 'Dry out']
      for (let i = 0; i < 3; i++){
        let obj = new OSCSwipeable(document.getElementById(`part-fx-route-${i}`),
          entries, labels, {'title' : 'Route part to...'});
        document.getElementById(`p-r-trigger-${i}`)
          .addEventListener('click', (ev)=>{
            obj.HTMLElement.querySelector("label").click()
         });
         obj.HTMLElement.addEventListener('act',onPartFXMatrixAct);
         //obj.HTMLElement.addEventListener('sync',onPartFXMatrixUpdate);
      }
      
    zsession.initPartFX = true;
  }
  
  new ZynthoREST().query('/status/partfx', 
    {id: zsession.partID} ).then ( (data) => {
    //fx buttons
    for (let i = 0; i < 3; i++) {
      let element = document.getElementById(`part-fx-${i}`);
      element.innerHTML = data.efx[i].name;
      if (data.efx[i].bypass)
        element.classList.add('disabled');
      else
        element.classList.remove('disabled');
     
     onPartFxSetMatrixValue(i, data.efx[i].route);
      
      //zsession.oscElements[`part-fx-route-${i}`].setValue(data.efx[i].route);
      //onPartFXMatrixUpdate(data);
    }
    
    
    for (let i = 0; i < 4; i++) {
      let id = `part-fx-send-${i}`;
      //let element = document.getElementById(id);
      zsession.oscElements[id].setLabel(data.sysefxnames[i]);
      zsession.oscElements[id].setEnabled((data.sysefxnames[i] != 'None'));
    }
    
    loadSection('section-part-fx');
    setSelectedToolbarButton(document.getElementById('part-toolbar-fx'));
  });
}

/* TODO: not an event */
function onPartFxSetMatrixValue(id, val) {
  for (let i = 0; i < 3; i++) {
      if (i != val) {
        document.getElementById(`p-r-${id}-${i}`)
          .classList.add('hide-content');
      } else {
        document.getElementById(`p-r-${id}-${i}`)
          .classList.remove('hide-content');
      }
  }
}

function onPartFXMatrixAct(data){
  let id = /Pefxroute(\d)/.exec(data.detail.script)[1];
  let val = parseInt(/\d+$/.exec(data.detail.script)[0]);
  
  onPartFxSetMatrixValue(id, val);
}

function onPartFXEdit(fxid) {
    zsession.fxcursor=`/part${zsession.partID}/partefx${fxid}`;
    new ZynthoREST().query('status/fx', {'path': zsession.fxcursor})
      .then ( (data) => {
        loadFXEditor(data, `Edit Part FX #${fxid}`, 'section-part-fx');
          
        document.querySelector('#fx-type select')
          .addEventListener('change', onPartFXEditFxChanged);
        zsession.oscElements['fx-part-bypass'].setEnabled(true);
        zsession.oscElements['fx-part-bypass']
          .HTMLElement.parentNode.classList.remove('hidden');
          
        document.querySelector('#fx-part-bypass')
          .addEventListener('sync', onPartFXEditFxBypass);
    });
}

function onPartFXEditFxChanged(event) {
  let changed = event.target.options[event.target.selectedIndex].text;
  let fxid = /\d+$/.exec(zsession.fxcursor)[0];
  document.getElementById(`part-fx-${fxid}`).innerHTML = changed;
}

function onPartFXEditFxBypass(event) {
  let fxid = /\d+$/.exec(zsession.fxcursor)[0];
  if (OSC_BOOL(event.detail[0]) == 'T')
    document.getElementById(`part-fx-${fxid}`).classList.add('disabled');
  else
    document.getElementById(`part-fx-${fxid}`).classList.remove('disabled');
}

function onTempo() {
  let currentvalue = parseInt(document.querySelector('#global-tempo p')
    .innerHTML);
  
  let newTempo = prompt('Enter new tempo', currentvalue);
  if (isNaN(newTempo) || newTempo < 1)
    return;
  else {
    zsession.oscElements['global-tempo'].act(newTempo)
    .then ( () => {
      zsession.oscElements['global-tempo'].setValue(newTempo)
      }) ;
  }
}

function onToobarFavoriteClick() {
  let status = $('#btnDoFavorite').hasClass('fas');
  let request = !status;
  
  
  let action = (value) ? 'set' : 'unset';
        
        //First, we update server
        doAjax({method:'post', url: window.location.href+"setFavorite",
                data: JSON.stringify({"instrument": instrument, "action": action}), 
                contentType: 'application/json; charset=utf-8'},
        function() {
          
          //Then we update client, without ajax
          if (!value) {
            zsession.banks['Favorites']= 
            zsession.banks.Favorites.filter( (entry) => {
              return (entry.path != instrument.path);});
          } else {
            zsession.banks.Favorites.push(instrument);
          }
          
          //last we update display
          if (instrument.name == zsession.getInstrument().name) {
            $('#btnDoFavorite i').removeClass('far fas');
            $('#btnDoFavorite i').addClass((value == true) ? 'fas' : 'far'); 
          }
          
          let li = $('#selInstruments li.selected');
          if (li !== undefined && li.attr('data-instrument') == instrument.path) {
            $(li).empty();
            $(li).text(instrument.name);
            if (value)
              $(li).append('<span style="float:right"><i class="fas fa-star"></i></span>');
          }
        });
}

function onToolbarChangePart(index) { 
  if (index !== undefined && index !== '')
    zsession.partID = parseInt(index);
  
  onToolbarUpdate();
}

function onToolbarUpdate() {
  new ZynthoREST().query('status', {partID : zsession.partID })
  .then ( (data) => {
    zsession.oscElements['global-tempo'].setValue(data['/tempo'][0], true);
    zsession.oscElements['global-volume'].setValue(data['/volume'][0], true);
    let part = `/part${zsession.partID}`;
    
    let enabled = data[`${part}/Penabled`][0];
    let name = null;
    
    if ( data[`${part}/Pname`][0] != '')
      name = data[`${part}/Pname`][0];
    else if (data['instrument']['name'])
      name = data['instrument']['name'];
    else
      name = 'Base sine wave';
  
    document.getElementById('instrumentName').innerHTML = 
          (enabled)
            ? `#${zsession.partID+1}: ${name}`
            : `#${zsession.partID+1}: Disabled`;
    
    displayOutcome ( data.session );
  });
}
