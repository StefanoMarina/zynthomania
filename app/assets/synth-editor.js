const FILTER_TYPES = [
   ['Low','Hi', 'Hi2', 'Band', 'Notch', 'Peak', 'LoShelf', 'HiShelf'], //analog
   [], //formant
   ['Low', 'High','Band', 'Notch'], //St Var
   ['High', 'Band', 'Low'], //Moog
   ['BWD', 'FWD', 'Both'] //Comb
 ];
 
const FILTER_TYPE_PARTIAL = [ 'Ptype' , '', 'type-svf', 'type-moog', 'type-comb'];

function loadFrequencyEditor(title, backto, target, path, lfo, envelope) {
  if (window.zsession.initFrequencyEditor === undefined) {
   let osc = new OSCSwipeable(document.getElementById('freq-detune-type'),
      [...Array(4).keys()],
      ['L. 35c', 'L. 10c', 'Ex. 100c', 'E. 1200c'],
      {'title': 'Select detune range'});
  
   osc.HTMLElement.querySelector('select')
    .addEventListener('change', onFreqEditChangeTune);
    
    osc = new OSCKnob(document.getElementById('freq-detune'));
    osc.serverRange = PITCH_CONTROL;
    
    new OSCKnob(document.getElementById('freq-coarse'),undefined,
      SEMITONE);
    
    new OSCKnob(document.getElementById('freq-octave'),undefined,
      OCTAVE);
    
    new OSCBoolean(document.getElementById('freq-para'));
    
    window.zsession.initFrequencyEditor = true;
  }
  
  let section = document.getElementById('synth-frequency-editor');
  section.querySelectorAll('div[data-partial]')
    .forEach ( (el) => {
      let id = el.id;
      let partial = el.dataset.partial;
      
      //hotfix for a DUMB move on OSC
      if (target == 'FM' && id == 'freq-para') {
        window.zsession.oscElements[id].oscpath = 
        `${path}/PFMFixedFreq`
      } else {
      window.zsession.oscElements[id].oscpath = 
        (partial.startsWith('P'))
          ? `${path}/P${target}${partial.slice(1)}`
          : `${path}/${target}${partial}`;
      }
  });
  
  if (window.zsession.synthID == 'ad' && window.zsession.voiceID == 127) {
    window.zsession.oscElements['freq-para'].oscpath = null;
    window.zsession.oscElements['freq-para'].HTMLElement
      .classList.add('hidden');
  } else {
    window.zsession.oscElements['freq-para'].HTMLElement
      .classList.remove('hidden');
  }
  
  section.dataset.title=title;
  section.dataset.back = backto;
  
  let el = document.getElementById('freq-open-lfo');
  if (lfo != null) {
    el.classList.remove('hidden');
    el.addEventListener('click', lfo);
  } else {
    el.classList.add('hidden');
  }
  
  el = document.getElementById('freq-open-envelope');
  if (envelope != null) {
    el.classList.remove('hidden');
    el.addEventListener('click', envelope);
  } else {
    el.classList.add('hidden');
  }
  
  
  osc_synch_section(section, true).then  ( ()=> {
    onFreqEditChangeTune();
    loadSection('synth-frequency-editor');
  });
  
} 

function onFreqEditChangeTune(event) {
  let value = [L35_TUNE, L10_TUNE, E100_TUNE, E1200_TUNE]
    [window.zsession.oscElements['freq-detune-type']
      .swipeable.selectElement.selectedIndex];
  
  window.zsession.oscElements['freq-detune'].range = value;
}

function loadEnvelopeEditor(title, backto, enabled, path, envelopes) {
  
  let envKnobs = [
  'adsr-t-a', 'adsr-t-d', 'adsr-t-r',
  'adsr-v-a', 'adsr-v-d', 'adsr-v-s', 'adsr-v-r'
  ];
      
  if (window.zsession.initADSREditor === undefined) {
    let enabledButton = 
      new OSCBoolean(document.getElementById('adsr-enabled'));
    //new OSCBoolean(document.getElementById('adsr-linear'));
    new OSCBoolean(document.getElementById('adsr-forced-release'));
    
    new OSCKnob(document.getElementById('adsr-stretch'));
    envKnobs.forEach ( (id) => new OSCKnob(document.getElementById(id)));
    
    enabledButton.bindEnable(...envKnobs);
    enabledButton.bindEnable('adsr-forced-release', 'adsr-stretch');
    
    window.zsession.initADSREditor = true;
  }
  
  let section = document.getElementById('synth-envelope-editor');
  section.dataset.title=title;
  section.dataset.back = backto;
  
  //check enabled
  if (enabled) {
    window.zsession.oscElements['adsr-enabled'].oscpath = enabled;
    window.zsession.oscElements['adsr-enabled'].HTMLElement.classList.remove('hidden');
  } else {
    window.zsession.oscElements['adsr-enabled'].setEnabled(true);
    window.zsession.oscElements['adsr-enabled'].HTMLElement.classList.add('hidden');
  }
  
  let showAnyTime = envelopes.slice(0,3).reduce ( (sum, b) => sum+b);
  let showAnyValue = envelopes.slice(3).reduce ( (sum, b) => sum+b);
  
  //reset time knobs
  //envKnobs.forEach ( id => window.zsession.oscElements[id].oscpath = null);
  
  if (!showAnyTime)
    document.getElementById('env-section-times').classList.add('hidden');  
  else
    document.getElementById('env-section-times').classList.remove('hidden');
  
  if (!showAnyValue)
    document.getElementById('env-section-values').classList.add('hidden');  
  else
    document.getElementById('env-section-values').classList.remove('hidden');
    
  for (let i = 0; i < envKnobs.length; i++) {
    let obj = window.zsession.oscElements[envKnobs[i]];
    if (envelopes[i]){
      obj.oscpath = `${path}/${obj.HTMLElement.dataset.partial}`;
      obj.HTMLElement.parentNode.classList.remove('hidden');
    }else {
      obj.oscpath = null;
      obj.HTMLElement.parentNode.classList.add('hidden');
    }
  }
  
  ['adsr-forced-release', 'adsr-stretch'].forEach ( (id) =>{
    let obj = window.zsession.oscElements[id];
    obj.oscpath = `${path}/${obj.HTMLElement.dataset.partial}`;
  });
  
  
  osc_synch_section(section, true).then  ( ()=> {
    loadSection('synth-envelope-editor');
  });
} 

function loadLFOEditor(backTo, enabled, path) {
  let knobs = ['lfo-frequency','lfo-stretch','lfo-depth','lfo-phase',
      'lfo-delay', 'lfo-fadein', 'lfo-fadeout', 'lfo-rand-amp',
      'lfo-rand-freq'];
      
  if (window.zsession.initLFOEditor === undefined) {
    new OSCBoolean(document.getElementById('lfo-enable'));
    new OSCBoolean(document.getElementById('lfo-cont'));
    
    new OSCSwipeable(document.getElementById('lfo-type'),
    [...Array(8).keys()],
    ['Sine','Triangle','Square','RampUp','RampDo','E1dn','E2dn','Random'],
    {'title':'Lfo Type'}
    );
    
      knobs. forEach( (id)=> {
          let obj = new OSCKnob(document.getElementById(id));
      });
    
    window.zsession.oscElements['lfo-frequency'].setRange(HERTZ);
    
    window.zsession.oscElements['lfo-delay'].setRange(
      { 'min': 0, 'max': 4.0,
        'type': 'centisecs to start', 'itype': 'f'}
    );
    
    window.zsession.oscElements['lfo-enable'].bindEnable (...knobs);
    window.zsession.oscElements['lfo-enable'].bindEnable('lfo-type',
      'lfo-cont');
    
    window.zsession.initLFOEditor = true;
    
    window.zsession.oscElements['lfo-fadein'].setRange(LFO_FADER);
    window.zsession.oscElements['lfo-fadeout'].setRange(LFO_FADER);
    
    let b = new OSCBundle();
     window.zsession.oscElements['bundle-lfo-sync'] = b;
    b.addEventListener('sync', ( data) => {
      let paths = b.getAbsolutePath();
      b.values= {
        'numerator' : parseInt(data[paths[0]][0]),
        'denominator' : parseInt(data[paths[1]][0])
      };
      
      window.zsession.oscElements['lfo-frequency']
        .setEnabled(
        window.zsession.oscElements['lfo-frequency'] &&
        (b.values['numerator'] <= 0));
    });
  }
  
  if (enabled != null) {
    window.zsession.oscElements['lfo-enable'].HTMLElement.classList.remove('hidden');
    window.zsession.oscElements['lfo-enable'].oscpath = enabled;
  } else {
    window.zsession.oscElements['lfo-enable'].HTMLElement.classList.add('hidden');
    window.zsession.oscElements['lfo-enable'].setEnabled(true);
    window.zsession.oscElements['lfo-enable'].oscpath = null;
  }
  
  //fill paths
  ['lfo-cont','lfo-type',...knobs].forEach( (id) => {
    let obj = window.zsession.oscElements[id];
    obj.oscpath = `${path}/${obj.HTMLElement.dataset.partial}`;
  });
  var bundle = window.zsession.oscElements['bundle-lfo-sync'];
  bundle.oscpath = [`${path}/numerator`, `${path}/denominator`];
  
  let section = document.getElementById('synth-lfo-editor');
  
  
  section.dataset.back = backTo;
  osc_synch_section(section).then( () => {
    return bundle.sync();
  }).then( ()=>{
    loadSection('synth-lfo-editor', true);
  });
  
}

function onLFOEditorSyncButton() {
  let b = window.zsession.oscElements['bundle-lfo-sync'];
  let string = `${b.values['numerator']}/${b.values.denominator}`;
  
  let result = prompt ('Input time fraction according to bpm. 0 to enable manual.',
      string);
  
  if (result == "0" || result == "") result = "0/0";
  let rex = /(\d+)\s*\/\s*(\d+)/.exec(result);
  try {
    b.values.numerator = parseInt(rex[1]);
    b.values.denominator = parseInt(rex[2]);
  } catch (err) {
    displayOutcome(err,true);
    return;
  }
  
  b.act([b.values.numerator,b.values.denominator]).then ( ()=>{
      window.zsession.oscElements['lfo-frequency']
        .setEnabled(
        window.zsession.oscElements['lfo-frequency'] &&
        (b.values['numerator'] <= 0));
      
  });
}

function onFilterEditorCategoryChange(ev) {
  let index = (ev.detail == null)
    ? ev.target.options[ev.target.selectedIndex].value
    : ev.detail[0];
    
  let obj = window.zsession.oscElements['filter-type'];
  let types = FILTER_TYPES[index];
  obj.setOptions([...Array(types.length).keys()], types);
  obj.oscpath = `${obj.path}/${FILTER_TYPE_PARTIAL[index]}`;
  obj.sync();  
}

function loadFilterEditor (title, backto, enabled, path, lfo, envelope) {
  if (window.zsession.initFilterEditor === undefined){
    new OSCBoolean (document.getElementById('filter-enable'));
    
    let swipe = new OSCSwipeable (document.getElementById('filter-category'),
      [0,2,3,4],
      ['Analog', 'St. Var.', 'Moog', 'Comb'],
      {'title': 'Filter category'}
    );
    
    swipe.selectElement.addEventListener('change',onFilterEditorCategoryChange);
    swipe.HTMLElement.addEventListener('sync',onFilterEditorCategoryChange);
    
    new OSCSwipeable (document.getElementById('filter-type'),
      [], [], {'title': 'Filter type', 'buttonClass': 'col-6'})
        .path = path;
        
    new OSCKnob(document.getElementById('filter-stages'), null,
      { 'min': 1, 'max': 5, 'type': 'Filter stages', 'itype': 'i' }
    );
    
    new OSCKnob(document.getElementById('filter-gain'), null,
      { 'min': -30.0, 'max': 30.0, 'type': 'Gain', 'itype': 'f' }
    );
    new OSCKnob(document.getElementById('filter-basefreq'), null,
      { 'min': 31.25, 'max': 32000.0, 'type': 'Frequency', 'itype': 'f' }
    );
    new OSCKnob(document.getElementById('filter-q'), null,
      { 'min': 0.01, 'max': 1000.0, 'type': 'Peak', 'itype': 'f' }
    );
    
    window.zsession.oscElements['filter-enable'].bindEnable(
     ...Array.from(document.querySelectorAll('#synth-edit-filter .osc-element'))
      .map ( (el)=>el.id)
      .filter ( (el => el != 'filter-enable'))
    );
    window.zsession.initFilterEditor = true;
  }
  
  //Global filter if ! eanbled
  if (enabled != null) {
    window.zsession.oscElements['filter-enable'].HTMLElement.classList.remove('hidden');
    window.zsession.oscElements['filter-enable'].oscpath = enabled;
  } else {
    window.zsession.oscElements['filter-enable'].HTMLElement.classList.add('hidden');
    window.zsession.oscElements['filter-enable'].setValue(true);
    window.zsession.oscElements['filter-enable'].oscpath = null;
  }
  Array.from(document.querySelectorAll('#synth-edit-filter .osc-element'))
      .map ( (el)=>el.id)
      .filter ( (id => id != 'filter-enable' && id != 'filter-type'))
      .forEach( (id) => {
        let obj = window.zsession.oscElements[id];
        obj.oscpath = `${path}/${obj.HTMLElement.dataset.partial}`;
  });
  
  window.zsession.oscElements['filter-type'].oscpath = null;
  
  let elementLFO = document.getElementById('filter-edit-lfo');
  if (lfo) {
    elementLFO.classList.remove('hidden');
    elementLFO.addEventListener('click', lfo);
  } else{
    elementLFO.classList.add('hidden');
  }
  let elementEnvelope = document.getElementById('filter-edit-envelope');
  if (envelope) {
    elementEnvelope.classList.remove('hidden');
    elementEnvelope.addEventListener('click', envelope);
  } else{
    elementEnvelope.classList.add('hidden');
  }

  let section = document.getElementById('synth-edit-filter');
  section.dataset.title = title;
  section.dataset.back = backto;
  osc_synch_section(section,true).then ( () => {
    loadSection('synth-edit-filter');
  });
}

function loadAmplitudeEditor(title, backto, lfo, envelope){
  if (window.zsession.initAmplitudeEditor === undefined){
    new OSCKnob(document.getElementById('amp-volume'),
      null, { 'min': -60, 'max' : 0, 'type': 'Volume (hz)', 'itype': 'f'});
    
    ['amp-panning', 'amp-delay', 'amp-punch', 'amp-punch-time']
      .forEach ( (id) => new OSCKnob(document.getElementById(id)));
    
    new OSCBoolean (document.getElementById('amp-bypass-global'));
    
    window.zsession.initAmplitudeEditor = true;
  }
  
  let isVoiceGlobal = 
    window.zsession.synthID == 'ad' &&
    window.zsession.voiceID == ADSYNTH_GLOBAL;
  
  showIf( 'global-punch' ,isVoiceGlobal);
  showIf( 'amp-bypass-global', !isVoiceGlobal);
  showIf( 'amp-delay', !isVoiceGlobal);
  
  if (isVoiceGlobal) {
    window.zsession.oscElements['amp-bypass-global']
      .oscpath = null;
    window.zsession.oscElements['amp-delay']
      .oscpath = null;
    window.zsession.oscElements['amp-punch'].setEnabled(true);
    window.zsession.oscElements['amp-punch-time'].setEnabled(true);
  } else {
    window.zsession.oscElements['amp-punch'].setEnabled(false);
    window.zsession.oscElements['amp-punch-time'].setEnabled(false);
  }
  
  if (window.zsession.synthID == 'sub' || isVoiceGlobal) {
    window.zsession.oscElements['amp-volume'].oscpath =
      window.zsession.oscElements['amp-volume'].
        oscpath.replace('volume', 'Volume');
  } else {
    window.zsession.oscElements['amp-volume'].oscpath =
      window.zsession.oscElements['amp-volume'].
        oscpath.replace('Volume', 'volume');
  }

  
  let elementLFO = document.getElementById('amp-edit-lfo');
  if (lfo) {
    elementLFO.classList.remove('hidden');
    elementLFO.addEventListener('click', lfo);
  } else{
    elementLFO.classList.add('hidden');
  }
  let elementEnvelope = document.getElementById('amp-edit-envelope');
  if (envelope) {
    elementEnvelope.classList.remove('hidden');
    elementEnvelope.addEventListener('click', envelope);
  } else{
    elementEnvelope.classList.add('hidden');
  }
  
  let section = document.getElementById('synth-edit-amp');
  section.dataset.title = title;
  section.dataset.back = backto;
  osc_synch_section(section).then ( ()=>{
    loadSection('synth-edit-amp');
  });
}
