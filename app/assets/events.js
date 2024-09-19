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

function onCopy() {  
 new ZynthoREST().post('script', {'script':
      `/presets/copy "${zsession.clipboard.path}"`
    }).then ( () =>{
      displayOutcome(`Copied ${zsession.clipboard.type}`);
      zsession.clipboardServerType = zsession.clipboard.type;
  });    
}

function onPaste() {
  if (zsession.clipboardServerType != 
    zsession.clipboard.type ) {
      displayOutcome(`Mismatch: ${zsession.clipboard.serverType} / ${zsession.clipboard.type}`,true);
    return;
  }
  
  new ZynthoREST().post('script', {'script':
      `/presets/paste "${zsession.clipboard.path}"`
    }).then ( () => {
      return zsession.clipboard.onPaste();
    }).then ( () =>{
      displayOutcome(`Pasted ${zsession.clipboard.type}`);
  });
}

function onLoadPreset() {
  let val = __ID('toolbar-presets').value;
  let section = document.querySelector('section.opened');
  console.log(`presets for section ${section}`);
  
  if (val == null) return;
  
  let zrest = new ZynthoREST();
  zrest.timeout = 10000;
  zrest.post('apply-preset', {
    'bank':  section.dataset.preset,
    'name' : val, 
    'keychain' : [
      window.zsession.partID,
      window.zsession.layerID,
      window.zsession.fxID,
      window.zsession.voiceID
    ]})
    .catch ( (err) => {
      displayOutcome('Failed!');
    })
    .then ( () => {
      return osc_synch_section(section);
    })
    .then (() => {
      section.dispatchEvent(new CustomEvent('preset'));
    });
}

 function onBanks() {
  //no more preloading banks
  
  new ZynthoREST().query('files/banks')
    .then((data) =>{
    
    let bankUI = __ID('select-bank');
    bankUI.size = data.zyn.length+data.cartridge.length+1;
    bankUI.options.length = 1;
 
    bankUI.options[0]
      .disabled = (window.zsession.favorites.length == 0)
    
    if ( data['cartridge'] ) {
      data.cartridge.forEach ( (item) => {
        let option = new Option ( /\/([^\/]+)$/.exec(item)[1], item );
        option.classList.add('cartridge');
        bankUI.options.add (option );
      });
    }
    
    data.zyn.forEach ( (item) => {
      bankUI.options.add ( new Option ( /\/([^\/]+)$/.exec(item)[1], item ) );
    });
  
    loadSection('section-select-bank');
    setSelectedToolbarButton(__ID('part-toolbar-bank'));
    __ID('banks-search-bar').classList.add('opened');
  });
}

function loadInstrumentSection(instruments, isFavorite) {
  let favPaths = zsession.favorites.map ( (fav) => fav.path );
  let select = __ID('select-instrument');
  select.options.length = 0;
  
  instruments.forEach ( (instr) => {
    let option = new Option ( instr.name, instr.path);
    if (isFavorite || favPaths.indexOf(instr.path) > -1 )
      option.classList.add('bookmark');
    select.options.add(option);
  });
  select.size = select.options.length+1;
      
  loadSection('section-select-patch');
  __ID('banks-search-bar').classList.add('opened');
}

function onBanksBankSelect() {
  let selBank = __ID('select-bank');
  let selection = selBank.value;
  selBank.selectedIndex = -1;
 // let selectedBank = event.target.dataset.bank;
  
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
    __ID('bankName').innerHTML= "/"+selection;
    loadInstrumentSection(instruments, selection == 'favorites');
    /*
      console.log(instruments);
      let select = __ID('select-instrument');
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
      
      __ID('bankName').innerHTML= "/"+selection;
      loadSection('section-select-patch');
      */
  });
}

function onBanksInstrumentSelect() {
  let select = __ID('select-instrument');
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
    let sel = __ID('system-bookmarks');
    sel.options.length = 0;
    zsession.favorites.forEach ( (book,index)=> {
      sel.options.add(new Option(book.name, index));
    });
    sel.size = sel.options.length+1;
    
    loadSection('section-bookmark-manager');
}

function onBookmarkRemove() {
  let sel = __ID('system-bookmarks');
  if ( sel.selectedIndex == -1)
    return;
  
  zsession.favorites.splice(sel.selectedIndex,1);
  sel.remove(sel.selectedIndex);
  new ZynthoREST().post('favorites', {'favorites': zsession.favorites});
}

function onBookmarkTrash() {
  if (confirm ( 'Remove all bookmarks? ') ) {
    let sel = __ID('system-bookmarks');
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
      var div = __ID('controller-device-list');
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
      new Swipeable ( __ID('bind-list-pointer'));
    
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
      id =>  __ID(id).disabled = true);
    
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
      id =>  __ID(id).disabled = true);
    
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
  let filename = __ID('file-dialog-filename').value;
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
  let filename = __ID('file-dialog-filename').value;
          
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
    new OSCKnob(__ID('glob-fx-0to1'));
    new OSCKnob(__ID('glob-fx-0to2'));
    new OSCKnob(__ID('glob-fx-0to3'));
    new OSCKnob(__ID('glob-fx-1to2'));
    new OSCKnob(__ID('glob-fx-1to3'));
    new OSCKnob(__ID('glob-fx-2to3'));
    
    __ID('section-global-fx').
      addEventListener('preset', onFXGlobal);
      
    zsession.initFxGlobal = true;
  }
    new ZynthoREST().post('script', {
        'requestResult': 1, 'script': '/sysefx[0-3]/efftype'})
      .then ( (data) => {
        console.log(data);
        
        let section = __ID('section-global-fx');
        
        for (let i = 0; i < 4; i++) {
          let btn = __ID(`glob-fx-${i}`);
          let val = data[`/sysefx${i}/efftype`][0];
          
          btn.innerHTML = effectTypeToString(val);
          
          section.querySelectorAll(`.gfx-name${i}`).forEach ( (el) => {
            el.innerHTML = effectTypeToString(val,true);
          });
        }
        
        return osc_synch_section(__ID('section-global-fx'));
    }).then (() =>{
        loadSection('section-global-fx');
        setSelectedToolbarButton(__ID('main-toolbar-fx'));
    });
}

function onFXGlobalEdit(fxid) {
    zsession.fxcursor=`/sysefx${fxid}`;
    zsession.setCopy('fx',`${zsession.fxcursor}/`, ()=> {
      onFXGlobalEdit(fxid);
    });
    
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
  __ID(`glob-fx-${fxid}`).innerHTML = changed;
}

function onSearchPatch() {
  let val = __ID('patch-search-bar').value;
  if (val.length < 2)
    return;
  new ZynthoREST().query('search', {'pattern': val })
    .then ( (data) => {
      console.log(data);
      __ID('bankName').innerHTML= "Search results";
      loadInstrumentSection(data, false);
  });
}

/**
 * SYSTEM / SESSION
 */
 
function onSessionNew() {
  if (!confirm('This will reset session file and any unsaved will be lost!\n'
    + ' Continue?')) {
      return;
  }
  
  new ZynthoREST().post('session/reset')
  .then ( () => { return new ZynthoREST().query('status/session');} )
  .then ( (sess)=> {
    console.log(sess);
    zsession.extdata = sess;
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
  let file = __ID('file-dialog-filename').value;
  new ZynthoREST().post('session/load', {'file': file})
    .then ( (sess)=>{ 
       zsession.extdata = sess;
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
  let file = __ID('file-dialog-filename').value;
  
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
  
  return zsession.oscElements['synth-toolbar-layer-enabled']
    .sync(). then( ()=>{
      return zsession.oscElements['bundle-synth-toolbar'].sync()
  }).then ( (data) => {
      let result = osc_map_to_control(data);
      //let damageSection = false;
      
      zsession.oscElements['synth-toolbar-layer-enabled']
        .setValue(result['Penabled']);
      
      showIf('synth-toolbar-ad-enabled', result['Padenabled'], 'gray');
      showIf('synth-toolbar-sub-enabled', result['Psubenabled'], 'gray');
      showIf('synth-toolbar-pad-enabled', result['Ppadenabled'], 'gray'); 
      
      
      if (!result['Padenabled'] && !result['Psubenabled']
        && !result['Ppadenabled']) {
          loadSection('section-synth-layer');
      } else  {
        onSynth();
      }
      
      zsession.elements['adsynth-voice'].setValue(zsession.voiceID);
      return result;
  });
}

function onSynthToolbarVoiceUpdate(event) {
  zsession.voiceID =  parseInt(
    event.target.options[event.target.selectedIndex].value
  );
  
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
    console.log( ( zsession.voiceID == ADSYNTH_GLOBAL)
      ? 'Switched to global controllers'
      : `Switched to voice #${zsession.voiceID}`
    );
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

function onLayerChange(event) {
  let data = event.detail;
  zsession.layerID = document.querySelector('#synth-layer select')
    .selectedIndex;
    
  zsession.oscElements['synth-toolbar-layer-enabled'].sync().then ( (data)=>{
    if (zsession.oscElements['synth-toolbar-layer-enabled']
      .HTMLElement.dataset.oscValue == 'F') {
        console.log('layer is disabled');
        onSynth('default');
    } else
    onSynthToolbarUpdate();
  });
}

function onSynth(synth) {
  initSynthToolbar();
  setSelectedToolbarButton(__ID('part-toolbar-synth'));
  
  if ('default' != synth) {
    //refresh synth cursor
    set_synth_cursor(synth);
    if (synth == undefined)
      synth = zsession.synthID;
  }
  
  zsession.reloadStack = []; //reset in case of toolbar click
  //zsession.reloadSynthSubSection = onSynth;
  switch (synth) {
    case 'sub' : onSynthSubsynth(); break;
    case 'ad' : onSynthAdsynth(); break;
    case 'pad': onSynthPadsynth(); break;
    case 'default': 
      loadSection('section-synth-layer');
    break;
    default: break;
  } 
}

function onSynthAdsynth() {
  if (zsession.initAdSynth === undefined) {
    
    let obj = new OSCBoolean(__ID('adsynth-enabled'));
    
    obj.HTMLElement.addEventListener('sync', onSynthEnableSync);
    obj.HTMLElement.addEventListener('act', onSynthEnableSync);
    obj.HTMLElement.addEventListener('act', (event)=>{
      let value = event.detail.script.endsWith('T');
      showIf('synth-adsynth-enable-before', !value );
      showIf('synth-adsynth-matrix', value );
      if (value)
        onSynthAdsynth();
    });
    
    new OSCPathElement(__ID('adsynth-vco-env-enable'),
      null,onSynthFrequencyEnvelope);
    new OSCPathElement(__ID('adsynth-vco-lfo-enable'),
      null,onSynthFrequencyLFO);
      
    obj = new OSCPathElement(__ID('adsynth-vcf-enable'),
      null,onSynthFilter);
    
    new OSCPathElement(__ID('adsynth-vcf-env-enable'),
      null,onSynthFilterEnvelope);
    new OSCPathElement(__ID('adsynth-vcf-lfo-enable'),
      null,onSynthFilterLFO);
    
    obj.bindEnable('adsynth-vcf-env-enable',
    'adsynth-vcf-lfo-enable');
    
    new OSCPathElement(__ID('adsynth-vca-env-enable'),
      null,onSynthAmplitudeEnvelope);
    new OSCPathElement(__ID('adsynth-vca-lfo-enable'),
      null,onSynthAmplitudeLFO);
    
    new OSCPathElement(__ID('adsynth-voice-enable'),
      null,onSynthAdsynthOscillator);
    
    
    zsession.initAdSynth = true;
 }
 
 set_synth_cursor('ad');
 let voiceControls = Array.from(__ID('voice-matrix')
    .querySelectorAll('.osc-element')).map ( (el)=> el.id );
 showIf('voice-matrix', zsession.voiceID != ADSYNTH_GLOBAL);

 let params = (zsession.voiceID != ADSYNTH_GLOBAL) 
  ? voiceControls : '';
  

  zsession.oscElements['adsynth-enabled'].sync().then( (data)=> {
    let value = Object.values(data)[0][0];
    showIf('synth-adsynth-enable-before', !value);
    showIf('synth-adsynth-matrix', value);
    
    return (value)
      ? osc_synch(...params)
      : Promise.resolve(false);
  }).then ( ()=> {
      loadSection('section-synth-adsynth');
      zsession.reloadSynthSubSection = onSynthAdsynth;
  });
   
}

function onSynthSubsynth() {
  if (window.initSubSynth === undefined) {
    new OSCPathElement(
      __ID('subsynth-vco-env-enable'),null,
      onSynthFrequencyEnvelope);
    
    new OSCPathElement(
      __ID('subsynth-vcf-enable'),null,
      onSynthFilter);
    
    let obj = new OSCBoolean(__ID('subsynth-enabled'));
    
    obj.HTMLElement.addEventListener('act', (event)=>{
      
      let value = event.detail.script.endsWith('T');
      showIf('synth-subsynth-enable-before', !value );
      showIf('synth-subsynth-matrix', value );
      
      if (value){
        Promise.resolve( osc_synch_section(
          __ID('section-synth-subsynth')
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
      ? osc_synch_section(__ID('section-synth-subsynth'))
      : Promise.resolve(false);
  }).then ( ()=> {
      loadSection('section-synth-subsynth');
      zsession.reloadSynthSubSection = onSynthSubsynth;
  });
}

function onSynthPadsynth() {
   if (zsession.initPadsynth === undefined) {
     let obj = new OSCBoolean(__ID('padsynth-enabled'));
    
    obj.HTMLElement.addEventListener('act', (event)=>{
      
      let value = event.detail.script.endsWith('T');
      
      //console.log(`Call: ${event.type}, ${value}`);
      
      showIf('synth-padsynth-enable-before', !value );
      showIf('synth-padsynth-matrix', value );
      __ID('padpars-prepare').disabled = !value;
      
      if (value){
        Promise.resolve( osc_synch_section(
          __ID('section-synth-subsynth')
        ))
      }
    });
    
    obj.HTMLElement.addEventListener('sync', onSynthEnableSync);
    obj.HTMLElement.addEventListener('act', onSynthEnableSync);
    zsession.initPadsynth = true;
   }
   
   set_synth_cursor('pad');
   zsession.oscElements['padsynth-enabled'].sync().then ( (data)=> {
     let value = Object.values(data)[0][0];
     showIf('synth-padsynth-enable-before', !value );
     showIf('synth-padsynth-matrix', value );
     __ID('padpars-prepare').disabled = !value;
     
     zsession.reloadSynthSubSection = onSynthPadsynth;
     loadSection('section-synth-padsynth');
   });
}

function onSynthPADOscillator() {
  zsession.onChangeSynth=onSynth;
  zsession.reloadSynthSubSection = onSynthPADOscillator;
  loadOscillatorEditor('Oscillator','oscilgen', false);
}

function onSynthPADHarmonics() {
  if (zsession.initPADHarmonics === undefined) {
    let obj = new OSCSwipeable(__ID('pad-spectrum'),
    [0,1,2],
    ['Bandwidth', 'Discrete', 'Continuous'],
    {'title': 'Spectrum mode', 'buttonClass' : 'col-12'}
    );
    obj.selectElement.addEventListener('change', (ev)=> {
      showIf('padsynth-bandwidth-section',
       ev.target.value == 0);
    });
    obj = new OSCSwipeable(__ID('padsynth-ot-position'),
      [...Array(8).keys()],
      ['Harmonic', 'Shift Up', 'Shift Low', 'Power U', 'Power L',
        'Sine', 'Power', 'Shift'],
      {'title': 'Overtones position', 'buttonClass': 'col-6 col-md-4'}
    );
    
    [1,2,3].forEach ( (i) => {
      new OSCKnob(__ID(`padsynth-ot-p${i}`), null,
        BYTE_RANGE);
    });
    
    //Non-harmonics may use parameters
    obj.swipeable.selectElement.addEventListener('change', (ev)=> {
      [1,2,3].forEach ( (i) => {
        window.zsession.oscElements[`padsynth-ot-p${i}`]
          .setEnabled(ev.target.value > 0);
      });
    });
    
    new OSCSwipeable(__ID('padsynth-bw-scale'),
      [...Array(8).keys()],
      ['Normal','Equal Hz', 'Quarter', 'Half', '75%', '150%', 'Double',
        'Inv. Half'],
      {'title': 'Bandwidth Scale', 'buttonClass' : 'col-12 col-md-6'}
    );
    
    obj = new OSCKnob(__ID('padsynth-bw'), null,
      {'min': 0.2, 'max' : 2500.0, 'itype' : 'f', 'type' : 'cents'}
    );
    obj.serverRange = {'min': 0, 'max' :1000, 'itype': 'i' };
    
    new OSCSwipeable(__ID('padsynth-bw-basetype'),
      [0,1,2],
      ['Gauss', 'Square', 'Double Exp'],
      {'title': 'Harmonic shape', 'buttonClass' : 'col-12'}
    );
    new OSCSwipeable(__ID('padsynth-bw-onehalf'),
      [0,1,2],
      ['Full', 'Upper half', 'Lower half'],
      {'title': 'Curve phase', 'buttonClass' : 'col-12'}
    );
    
    new OSCSwipeable(__ID('padsynth-bw-amptype'),
      [0,1,2,3],
      ['None', 'Gauss', 'Sine', 'Flat'],
      {'title': '2nd mod curve', 'buttonClass' : 'col-4'}
    );
    
    new OSCSwipeable(__ID('padsynth-bw-ampmode'),
      [0,1,2,3],
      ['Sum', 'Multiply', 'Division1', 'Division2'],
      {'title': '2nd mod formula', 'buttonClass' : 'col-12 col-md-6'}
    );
  
    new OSCBoolean(__ID('padsynth-bw-autoscale'));
    new OSCKnob(__ID('padsynth-bw-amp-par1'));
    new OSCKnob(__ID('padsynth-bw-amp-par2'));
    
    for (let i = 1; i < 5; i++)
      new OSCKnob(__ID(`padsynth-bw-spread${i}`));
    
    zsession.initPADHarmonics = true;
  }
  
  osc_synch_section('synth-padsynth-harmonics').then ( ()=> {
    loadSection('synth-padsynth-harmonics');
  });
}
function onSynthAdsynthFM() {
  if (zsession.initSynthFM === undefined) {
    new OSCSwipeable(__ID('synth-osc-fm'),
     [...Array(6).keys()],
     ['Off','Morph','Ring', 'PM', 'FM', 'PWM'],
     {'title': 'Frequency Mod Type', 'buttonClass': 'col-12'}
    );
    
    new OSCKnob(__ID('synth-fm-volume'),
      undefined, PERCENTAGE_F);
    new OSCKnob(__ID('synth-fm-damp'));
    new OSCKnob(__ID('synth-fm-velo'));
    
    //Unison
    new OSCKnob(__ID('synth-uni-size'), undefined,
      {'min':1,'max':50, 'itype': 'i', 'type': '# of voices'});
      
    let osc = new OSCKnob(__ID('synth-uni-spread'), undefined,
      {'min':0,'max':200, 'type': '%', 'itype': 'i'});
    osc.serverRange = CC_RANGE;
    
    new OSCKnob(__ID('synth-uni-phase'));
    new OSCKnob(__ID('synth-uni-vib'));
    new OSCKnob(__ID('synth-uni-speed'));
    
    new OSCPathElement(__ID('adsynth-fm-vco-env-enable'),
      null,onSynthFMFrequencyEnvelope);
    new OSCPathElement(__ID('adsynth-fm-vca-env-enable'),
      null,onSynthFMAmplitudeEnvelope);
      
   zsession.initSynthFM = true;
  }
  
  osc_synch_section(__ID('section-adsynth-fm')).then ( ()=> {
    zsession.onChangeSynth=onSynth;
    zsession.reloadSynthSubSection = onSynthAdsynthFM;
    loadSection('section-adsynth-fm');
  });
}

function onSynthAdsynthOscillator() {
  zsession.onChangeSynth=onSynth;
  zsession.reloadSynthSubSection = onSynthAdsynthOscillator;
  loadOscillatorEditor('Oscillator','OscilSmp', true);
}
function onSynthAdsynthFMOscillator() {
  zsession.onChangeSynth=onSynth;
  zsession.reloadSynthSubSection = onSynthAdsynthFMOscillator;
  loadOscillatorEditor('FM Oscillator','FMSmp', false);
}

function onSynthAmplitude(event) {
  
  zsession.reloadSynthSubSection = onSynthAmplitude;
  
  let forceGlobal = (typeof event == 'object') ? false : event;
  
  if (forceGlobal)
    zsession.elements['adsynth-voice'].setSelection(0,false);
    
  loadAmplitudeEditor('VCA', 
  (window.zsession.synthID != 'sub') ? onSynthAmplitudeLFO : null,
    onSynthAmplitudeEnvelope);
}

function onSynthAmplitudeLFO() {
  zsession.reloadSynthSubSection = onSynthAmplitudeLFO;
  
  let sc = osc_sanitize('/synthcursor/AmpLfo');
  
  zsession.setCopy('lfo', sc+'/', onSynthAmplitudeLFO);
  
  let enable = (zsession.voiceID == ADSYNTH_GLOBAL)
    ? null 
    : osc_sanitize('/synthcursor/PAmpLfoEnabled');
    
  loadLFOEditor(  enable, sc);
}

function onSynthAmplitudeEnvelope() {
  zsession.reloadSynthSubSection = onSynthAmplitudeEnvelope;
  
  let sc = osc_sanitize('/synthcursor/AmpEnvelope');
  zsession.setCopy('env', sc+'/', onSynthAmplitudeEnvelope);
  
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
  
  zsession.setCopy('vcf', `${sc}/`, onSynthFilter);
  
  loadFilterEditor('VCF', 
    enable, sc, 
    (window.zsession.synthID != 'sub') ? onSynthFilterLFO : null
    , onSynthFilterEnvelope);
}

function onSynthFilterLFO() {
  zsession.reloadSynthSubSection = onSynthFilterLFO;
  
  let sc = osc_sanitize('/synthcursor/FilterLfo');
  zsession.setCopy('lfo', `${sc}/`, onSynthFilterLFO);
  
  let enable = (zsession.voiceID == ADSYNTH_GLOBAL)
    ? null 
    : osc_sanitize('/synthcursor/PFilterLfoEnabled');
    
  loadLFOEditor( enable, sc);
}

function onSynthFilterEnvelope() {
  zsession.reloadSynthSubSection = onSynthFilterEnvelope;
  
  let sc = osc_sanitize('/synthcursor/FilterEnvelope');
  zsession.setCopy('env', `${sc}/`, onSynthFilterEnvelope);
  
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
  zsession.setCopy('vco', `${sc}/`, onSynthFrequency);
  
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
  
  zsession.setCopy('lfo', `${sc}/`, onSynthFrequencyLFO);
  
  loadLFOEditor( enable, sc);
}

function onSynthFrequencyEnvelope() {
  zsession.reloadSynthSubSection = onSynthFrequencyEnvelope;
  
  let sc = osc_sanitize('/synthcursor/FreqEnvelope');
  
  let enable = (zsession.voiceID == ADSYNTH_GLOBAL)
    ? null : osc_sanitize('/synthcursor/PFreqEnvelopeEnabled');
  
  zsession.setCopy('env', `${sc}/`, onSynthFrequencyEnvelope);
  
  loadEnvelopeEditor(
  'Wave Frequency Env.', 
  enable, sc,
  [1,0,1,1,0,0,1]
  );
}


function onSynthFMAmplitude(event) {
  zsession.reloadSynthSubSection = onSynthFMAmplitude;
  
  let forceGlobal = (typeof event == 'object') ? false : event;
  
  if (forceGlobal)
    zsession.elements['adsynth-voice'].setSelection(0,false);
    
  loadAmplitudeEditor('FM-VCA', null, onSynthFMAmplitudeEnvelope);
}

function onSynthFMAmplitudeEnvelope() {
  zsession.reloadSynthSubSection = onSynthFMAmplitudeEnvelope;
  
  let sc = osc_sanitize('/synthcursor/FMAmpEnvelope');
  zsession.setCopy('env', sc+'/', onSynthFMAmplitudeEnvelope);
  
  let enable = (zsession.voiceID == ADSYNTH_GLOBAL)
    ? null 
    : osc_sanitize('/synthcursor/PFMAmpEnvelopeEnabled');
    
  loadEnvelopeEditor('FM Amp Envelope', 
   enable, sc,
   [1,1,1,0,0,1,0]
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
  zsession.setCopy('env', `${sc}/`, onSynthFMFrequencyEnvelope);
    
  loadEnvelopeEditor('FM Frequency Env', 
    osc_sanitize('/synthcursor/PFMAmpEnvelopeEnabled'),
    sc,
    [1,0,1,1,0,0,1]
  );     
}

function onSynthSubMagnitude() {
  if (zsession.initSubH === undefined){
  
    new OSCSwipeable(__ID('sub-h-mag-type'),
    [0,1,2,3,4],
    ['Linear', '-40 Db', '-60 Db', '-80 Db', '-100 Dd'],
    {'title' :'Magnitude type', 'buttonClass': 'col-4 col-lg-2'}
    );
    
    new OSCSwipeable(__ID('sub-h-spread-type'),
    [...Array(8).keys()],
    ['Harmonic', 'Shift U', 'Shift L', 'Power U', 'Power L', 'Sine', 'Power', 'Shift'],
    {'title' :'Spread type', 'buttonClass': 'col-6 col-lg-4'}
    );
    
    new OSCKnob(__ID('sub-h-stages'),
      null, {'min': 1, 'max': 5, 'type': 'Stages', 'itype': 'i'});
        
    for (let i = 1; i < 4; i++) {
      let obj = new OSCKnob(__ID(`sub-h-spread-${i}`));
      obj.label="Parameter " + i;
    }
    
    new OSCGraph(__ID('sub-magnitude'),32,0);
    
    zsession.initSubH = true;
  }
  
  osc_synch_section(__ID('section-synth-harmonics'))
    .then ( () => {
      loadSection ('section-synth-harmonics');
    });
}

function onSynthSubBandwidth() {
   if (zsession.initSubB === undefined){
     new OSCSwipeable(__ID('sub-band-init'),
     [0,1,2],
     ['Zero', 'Rand', 'Ones']);
     
     new OSCKnob(__ID('sub-band-band'));
     new OSCKnob(__ID('sub-band-stretch'));

         
   new OSCGraph(__ID('sub-relbw'),32,64);
    
     zsession.initSubB = true;
   }
   
   osc_synch_section(__ID('synth-subsynth-bandwidth'))
    .then ( ()=> {
      loadSection('synth-subsynth-bandwidth');
    });
}

function onNetwork() {
  new ZynthoREST().query('system/network')
    .then ( (data) =>{
    zsession.hotspotMode = data.isHotSpot !== undefined;
    if (zsession.hotspotMode)
      __ID('network-hotspot')
        .innerHTML = "Restore local wifi";
    else
      __ID('network-hotspot')
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
  setSelectedToolbarButton(__ID('main-toolbar-system'));
}

function onSystemInfo() {
  new ZynthoREST().query('system/info')
    .then ( (data) =>{
      let section = __ID('section-system-info');
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
    
  let zyn = __ID('module-zyn-status');
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
    
    let zyn = __ID('module-zyn-status');
    zyn.classList.remove('fa-toggle-on', 'fa-toggle-off');
    zyn.classList.add( ( data.zynProcess != 'NA') 
         ? 'fa-toggle-on' : 'fa-toggle-off');
    let jack = __ID('module-jack-status');
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
  let section = __ID('section-save-instrument');
  section.dataset.back = backTo;
  
  new ZynthoREST().query('files/banks', null).then((data) =>{
    let select = __ID('save-instrument-bank-folder');
    select.innerHTML = '';
    data.cartridge.forEach ( (dir) => select.options.add(
      new Option(/\/([^\/]+)$/.exec(dir)[1], dir)));
    
    return new ZynthoREST().post('script', 
      { 'requestResult': 1,
        'script': [
          osc_sanitize('/part/Pname'),
          osc_sanitize('/part/info.Pauthor') 
        ]
      }
    );
  }).then ( (data)=> {
    __ID('save-instrument-name')
      .value = data[osc_sanitize('/part/Pname')][0];
    __ID('save-instrument-author')
      .value = data[osc_sanitize('/part/info.Pauthor')][0];
      
    if (!isNaN(zsession.lastLoadedInstrument[zsession.partID]))
      __ID('save-instrument-program')
        .value = zsession.lastLoadedInstrument[zsession.partID];
    else
      __ID('save-instrument-program').value = -1;
      
    loadSection('section-save-instrument');
  });
}

function onPartInstrumentSaveClick() {
  let folder = 
    __ID('save-instrument-bank-folder').value;
  
   new ZynthoREST().query('files/banks/xiz', {'bank': folder} )
    .then( (data)=> {
      let rex = /.*\/(.+)$/;
      let files = data.map ( (d) => rex.exec(d.path)[1]);
      
      fileDialog('save', files, {'folder':`/${folder}`}, 
        onPartInstrumentSaveOk);
      
      __ID('file-dialog-filename').value =
        __ID('save-instrument-name').value
        .replace(/[ :,\/]+/, '_')
        .concat('.xiz');
    });   
}

function onPartInstrumentSaveOk() {
  let file = __ID('file-dialog-filename').value;
  if ( file == '' ) throw 'Empty file';
  
  if (!file.endsWith('xiz'))
    file = file + '.xiz';
    
  new ZynthoREST().post('save_xiz',
    {
      'program' : __ID('save-instrument-program').value,
      'bank' : __ID('save-instrument-bank-folder').value,
      'partID' : zsession.partID,
      'file' : file,
      'name' : __ID('save-instrument-name').value,
      'author': __ID('save-instrument-author').value
    }
  ).then ( (msg)=>{
      displayOutcome(msg);
  })
}

function onPartMixer() {
  if (zsession.initPartMixer === undefined) {
    zsession.oscElements['part-enable'] =
      new OSCBoolean(__ID('part-enable'));
    zsession.oscElements['part-enable'].setLabel('Enable');
    
    let volumeKnob = new OSCKnob(__ID('part-volume'));
    volumeKnob.setLabel('Volume');
    zsession.oscElements['part-volume'] = volumeKnob;
    
    zsession.oscElements['part-balance'] = 
      new OSCKnob(__ID('part-panning'));
    zsession.oscElements['part-balance'].setLabel("Balance");
    
    let btn = new OSCButton(__ID('part-clear'));
    btn.HTMLElement.addEventListener('act',  ()=>{
      zsession.extdata.instruments[0] = {'name': 'Basic Sine Wave', 'path' : null};
      onToolbarUpdate();
    });
    
    zsession.initPartMixer = true;
  }
  
  osc_synch_section(__ID('section-part-main'))
  .then ( ()=> {
    updatePartMixerBookmark();
    loadSection('section-part-main');
    setSelectedToolbarButton(document.querySelector('#partToolbar > button:nth-child(1)'));
  });
}

function updatePartMixerBookmark() {
    //check bookmark status
    let instrument = zsession.extdata.instruments[zsession.partID];
    let icon = __ID('part-favorite');

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
  let name = prompt('Enter new bank name', 'New bank');
  if (name == '' || name == null)
    return;
  name = name.toLowerCase().replace(/:,;+\/\\/,'_');
  new ZynthoREST().post('files/newbank',{ 'dir' : name });
}

function onMixer() {
  if (zsession.initMixer === undefined) {
    let bundleArray = [];
    
    for (let i = 0; i < 16; i++) {
      new OSCBoolean(__ID(`mixer-part-${i+1}-enabled`));
      new OSCKnob(__ID(`mixer-part-${i+1}-volume`))
      new OSCKnob(__ID(`mixer-part-${i+1}-pan`))
      bundleArray.push(`/part${i}/Pname`);
    }
    zsession.oscElements['bundle-mixer-names'] = new OSCBundle(bundleArray);
    
    zsession.initMixer = true;
  }
  osc_synch_section(__ID('section-mixer'))
    .then ( ()=>{
        return zsession.oscElements['bundle-mixer-names'].sync();
   }).then ( (data)=>{
        
        for (let i = 1; i < 17; i++){
          __ID(`mixer-part-${i}-name`).innerHTML =
            (`${i}. `+data[`/part${i-1}/Pname`][0]);
        }
        loadSection('section-mixer');
        setSelectedToolbarButton(__ID('main-toolbar-mixer'));
    });
}
function onPartControl() {
  
  // Init controls
  if (zsession.initControl === undefined) {
     new OSCSwipeable(
      __ID('part-ctl-channel'),
      OneToSixteen.map ( (e)=> e-1), 
      OneToSixteen.map( (val, index, arr) => 
        {return "#"+String(index+1).padStart(2,'0');} ),
      { 'title' : 'Channel', 'class' : 'col-4' }
    );
    
    //zsession.oscElements['part-ctl-channel'].setLabel('Midi channel', 'Midi');
    
      new OSCMidiNote( __ID('part-ctl-minkey') );
      new OSCMidiNote( __ID('part-ctl-maxkey') );
      new OSCKnob( __ID('part-ctl-transpose') )
        .range = SEMITONE;
      
    zsession.initControl = true;
  }
  
   osc_synch_section(
        __ID('section-part-control'))
    .then ( () => {
      loadSection('section-part-control');
    setSelectedToolbarButton(
      document.querySelector('#partToolbar .i-piano')
      .parentElement);
    });
    
}

function onPartPlaystyle(event) {
  new ZynthoREST().post('playstyle',{
    'partID': zsession.partID, 'playstyle' : event.target.value
  }).then ( ()=>{
    zsession.extdata.playstyles[zsession.partID] = event.target.value;
  });
}

function onPartControlPoly() {
  if (zsession.initControlPoly === undefined) {
    new OSCSwipeable(
      __ID('part-ctl-polytype'),
      [0,1,2,3], 
      ['Poly', 'Mono', 'Legato', 'Latch'],
      { 'title' : 'Poly mode', 'class' : 'col-12' }
    );
    zsession.oscElements['part-ctl-polytype']
      .setLabel('Polyphony mode', 'Polyphony');
      
    
      new OSCKnob(__ID('part-ctl-keylimit'));
    zsession.initControlPoly = true;
  }
  
  osc_synch_section(__ID('section-ctl-poly'))
    .then ( () => {
    //enable section
    loadSection('section-ctl-poly');
  });
}

function onPartControlVelo() {
  if (zsession.initControlVelo === undefined) {
      new OSCKnob(__ID('part-ctl-velsns'));
      new OSCKnob(__ID('part-ctl-veloffs'));
    zsession.initControlVelo = true;
  }
  
  osc_synch_section(__ID('section-ctl-velocity'))
    .then ( () => {
    //enable section
    loadSection('section-ctl-velocity');
  });
}

function onPartControlDepth() {
  if (zsession.initControlDepth === undefined) {  
    new OSCKnob(__ID('part-ctl-depth-pan'));
    new OSCKnob(__ID('part-ctl-depth-cutoff'));
    new OSCKnob(__ID('part-ctl-depth-q'));
    new OSCKnob(__ID('part-ctl-depth-modwheel'));
    new OSCBoolean(__ID('part-ctl-modwheel-exponential'));
    new OSCBoolean(__ID('part-ctl-bandwidth-exponential'));
    new OSCKnob(__ID('part-ctl-depth-bandwidth'));
    new OSCBoolean(__ID('part-ctl-expression-receive'));
    new OSCBoolean(__ID('part-ctl-volume-receive'));
    new OSCBoolean(__ID('part-ctl-fmamp-receive'));
    new OSCBoolean(__ID('part-ctl-sustain-receive'));
    zsession.initControlDepth = true;
  }
  osc_synch_section(__ID('section-part-control-response'))
    .then ( () => { loadSection('section-part-control-response');
  });
}

function onPartControlPitch() {
  if (zsession.initControlPitch === undefined) {  
    
    new OSCKnob(__ID('part-ctl-pitch-range'),
      null, BEND_RANGE);
    //zsession.oscElements['part-ctl-pitch-range']
    //  .range = BEND_RANGE;
      
    new OSCBoolean(__ID('part-ctl-pitch-split'));
    
    new OSCKnob(__ID('part-ctl-pitch-range-down'),
      null, BEND_RANGE);
      //zsession.oscElements['part-ctl-pitch-range-down']
      //  .range = BEND_RANGE;
    
    zsession.oscElements['part-ctl-pitch-split']
      .bindEnable('part-ctl-pitch-range-down');
    zsession.initControlPitch = true;
  }
  
  osc_synch_section(__ID('section-part-control-pitch'))
    .then ( () => {
      loadSection('section-part-control-pitch');
  });
}

function onPartControlPortamento() {
  if (zsession.initPartControlPortamento === undefined) {
    new OSCBoolean(__ID('part-ctl-port-enable'));
    new OSCBoolean(__ID('part-ctl-port-receive'));
    new OSCKnob(__ID('part-ctl-port-length'));
    new OSCKnob(__ID('part-ctl-port-updown'));
    
    new OSCBoolean(__ID('part-ctl-port-proportional'));
    new OSCKnob(__ID('part-ctl-port-proprate'));
    new OSCKnob(__ID('part-ctl-port-propdepth'));
    
    zsession.oscElements['part-ctl-port-proportional']
      .bindEnable( 'part-ctl-port-proprate', 'part-ctl-port-propdepth' );
    
    new OSCSwipeable(__ID('part-ctl-port-pitchtype'),
      ['F', 'T'],
      ['Include','Exclude'],
      {'title': 'Threshold behaviour'}
      );
    //new OSCBoolean(__ID('part-ctl-port-pitchtype'));
    new OSCKnob(__ID('part-ctl-port-pitchthresh'));
    zsession.initPartControlPortamento = true;
    
    zsession.oscElements['part-ctl-port-enable'].bindEnable(
      'part-ctl-port-length', 'part-ctl-port-updown',
      'part-ctl-port-proportional', 'part-ctl-port-pitchtype',
      'part-ctl-port-pitchthresh');
  }
  
  osc_synch_section(__ID('section-part-control-portamento'))
    .then ( () => {
      loadSection('section-part-control-portamento');
  });
}

function onPartFX() {
  if (zsession.initPartFX == undefined){
    
      //initialize send to global
      for (let i = 0; i < 4; i++)
        new OSCKnob(__ID(`part-fx-send-${i}`));
    
      //Initialize route matrix
      let entries = [0,1,2];
      let labels = ['Next', 'Part out', 'Dry out']
      for (let i = 0; i < 3; i++){
        let obj = new OSCSwipeable(__ID(`part-fx-route-${i}`),
          entries, labels, {'title' : 'Route part to...'});
        __ID(`p-r-trigger-${i}`)
          .addEventListener('click', (ev)=>{
            obj.HTMLElement.querySelector("label").click()
         });
         obj.HTMLElement.addEventListener('act',onPartFXMatrixAct);
         //obj.HTMLElement.addEventListener('sync',onPartFXMatrixUpdate);
      }
    
    __ID('section-part-fx').addEventListener(
      'preset', onPartFX);
    zsession.initPartFX = true;
  }
  
  new ZynthoREST().query('/status/partfx', 
    {id: zsession.partID} ).then ( (data) => {
      
    //fx buttons
    for (let i = 0; i < 3; i++) {
      let element = __ID(`part-fx-${i}`);
      element.innerHTML = data.efx[i].name;
      showIf (element, !data.efx[i].bypass, 'disabled');
      onPartFxSetMatrixValue(i, data.efx[i].route);
    }
    
    for (let i = 0; i < 4; i++) {
      let id = `part-fx-send-${i}`;
      zsession.oscElements[id].oscpath
        =`/Psysefxvol${i}/part${zsession.partID}`;
      //let element = __ID(id);
      zsession.oscElements[id].setLabel(data.sysefxnames[i]);
      zsession.oscElements[id].setEnabled((data.sysefxnames[i] != 'None'));
      zsession.oscElements[id].setValue(data.send[i],true);
    }
    
    loadSection('section-part-fx');
    setSelectedToolbarButton(__ID('part-toolbar-fx'));
  });
}

/* TODO: not an event */
function onPartFxSetMatrixValue(id, val) {
  for (let i = 0; i < 3; i++) {
      if (i != val) {
        __ID(`p-r-${id}-${i}`)
          .classList.add('hide-content');
      } else {
        __ID(`p-r-${id}-${i}`)
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
    zsession.fxID = fxid;
    
    zsession.setCopy('fx',`${zsession.fxcursor}/`, ()=> {
      onPartFXEdit(fxid);
    });
    
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
  __ID(`part-fx-${fxid}`).innerHTML = changed;
}

function onPartFXEditFxBypass(event) {
  let fxid = /\d+$/.exec(zsession.fxcursor)[0];
  if (OSC_BOOL(event.detail[0]) == 'T')
    __ID(`part-fx-${fxid}`).classList.add('disabled');
  else
    __ID(`part-fx-${fxid}`).classList.remove('disabled');
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
  
    __ID('instrumentName').innerHTML = 
          (enabled)
            ? `#${zsession.partID+1}: ${name}`
            : `#${zsession.partID+1}: Disabled`;
    
    displayOutcome ( data.session );
  });
}
