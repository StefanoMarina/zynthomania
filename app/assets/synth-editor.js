const FILTER_TYPES = [
   ['Low','Hi', 'Hi2', 'Band', 'Notch', 'Peak', 'LoShelf', 'HiShelf'], //analog
   [], //formant
   ['Low', 'High','Band', 'Notch'], //St Var
   ['High', 'Band', 'Low'], //Moog
   ['BWD', 'FWD', 'Both'] //Comb
 ];
 
const FILTER_TYPE_PARTIAL = [ 'Ptype' , '', 'type-svf', 'type-moog', 'type-comb'];

function loadFrequencyEditor(title, target, path, lfo, envelope) {
  if (zsession.initFrequencyEditor === undefined) {
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
    
    zsession.initFrequencyEditor = true;
  }
  
  let section = document.getElementById('synth-frequency-editor');
  section.querySelectorAll('div[data-partial]')
    .forEach ( (el) => {
      let id = el.id;
      let partial = el.dataset.partial;
      
      //hotfix for a DUMB move on OSC
      if (target == 'FM' && id == 'freq-para') {
        zsession.oscElements[id].oscpath = 
        `${path}/PFMFixedFreq`
      } else {
      zsession.oscElements[id].oscpath = 
        (partial.startsWith('P'))
          ? `${path}/P${target}${partial.slice(1)}`
          : `${path}/${target}${partial}`;
      }
  });
  
  if (zsession.synthID == 'ad' && zsession.voiceID == 127) {
    zsession.oscElements['freq-para'].oscpath = null;
    zsession.oscElements['freq-para'].HTMLElement
      .classList.add('hidden');
  } else {
    zsession.oscElements['freq-para'].HTMLElement
      .classList.remove('hidden');
  }
  
  
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
  
  
  section.dataset.title=title;
  
  osc_synch_section(section, true).then  ( ()=> {
    onFreqEditChangeTune();
    loadSection('synth-frequency-editor', true);
  });
  
} 

function onFreqEditChangeTune(event) {
  let value = [L35_TUNE, L10_TUNE, E100_TUNE, E1200_TUNE]
    [zsession.oscElements['freq-detune-type']
      .swipeable.selectElement.selectedIndex];
  
  zsession.oscElements['freq-detune'].range = value;
}

function loadEnvelopeEditor(title, unused, path, envelopes) {
  
  let envKnobs = [
  'adsr-t-a', 'adsr-t-d', 'adsr-t-r',
  'adsr-v-a', 'adsr-v-d', 'adsr-v-s', 'adsr-v-r'
  ];
      
  if (zsession.initADSREditor === undefined) {
    new OSCBoolean(document.getElementById('adsr-forced-release'));
    
    new OSCKnob(document.getElementById('adsr-stretch'));
    envKnobs.forEach ( (id) => new OSCKnob(document.getElementById(id)));
    zsession.initADSREditor = true;
  }
  
  let section = document.getElementById('synth-envelope-editor');
  section.dataset.title=title;
   
  let showAnyTime = envelopes.slice(0,3).reduce ( (sum, b) => sum+b);
  let showAnyValue = envelopes.slice(3).reduce ( (sum, b) => sum+b);
  
  //reset time knobs
  //envKnobs.forEach ( id => zsession.oscElements[id].oscpath = null);
  
  showIf('env-section-times', showAnyTime);
  showIf('env-section-values', showAnyValue);
  
  for (let i = 0; i < envKnobs.length; i++) {
    let obj = zsession.oscElements[envKnobs[i]];
    if (envelopes[i]){
      obj.oscpath = `${path}/${obj.HTMLElement.dataset.partial}`;
      obj.HTMLElement.parentNode.classList.remove('hidden');
    }else {
      obj.oscpath = null;
      obj.HTMLElement.parentNode.classList.add('hidden');
    }
  }

  //is 'Att' always visible?
  if (showAnyTime < 4) {
    zsession.oscElements['adsr-t-a'].HTMLElement.parentNode.classList.add(
      'offset-'+(4-showAnyTime));
  } else {
    zsession.oscElements['adsr-t-a'].HTMLElement.parentNode.classList
      .remove('offset-1','offset-2','offset-3');
  }
  if (showAnyValue < 4) {
    zsession.oscElements['adsr-v-a'].HTMLElement.parentNode.classList.add(
      'offset-'+(4-showAnyTime));
  } else {
    zsession.oscElements['adsr-v-a'].HTMLElement.parentNode.classList
      .remove('offset-1','offset-2','offset-3');
  }
  
  ['adsr-forced-release', 'adsr-stretch'].forEach ( (id) =>{
    let obj = zsession.oscElements[id];
    obj.oscpath = `${path}/${obj.HTMLElement.dataset.partial}`;
  });
  
  
  osc_synch_section(section, true).then  ( ()=> {
    loadSection('synth-envelope-editor', true);
  });
} 

function loadLFOEditor(enabled, path) {
  let knobs = ['lfo-frequency','lfo-stretch','lfo-depth','lfo-phase',
      'lfo-delay', 'lfo-fadein', 'lfo-fadeout', 'lfo-rand-amp',
      'lfo-rand-freq'];
      
  if (zsession.initLFOEditor === undefined) {
    new OSCBoolean(document.getElementById('lfo-cont'));
    
    new OSCSwipeable(document.getElementById('lfo-type'),
    [...Array(8).keys()],
    ['Sine','Triangle','Square','RampUp','RampDo','E1dn','E2dn','Random'],
    {'title':'Lfo Type'}
    );
    
      knobs. forEach( (id)=> {
          let obj = new OSCKnob(document.getElementById(id));
      });
    
    zsession.oscElements['lfo-frequency'].setRange(HERTZ);
    
    zsession.oscElements['lfo-delay'].setRange(
      { 'min': 0, 'max': 4.0,
        'type': 'centisecs to start', 'itype': 'f'}
    );
    
   
    zsession.oscElements['lfo-fadein'].setRange(LFO_FADER);
    zsession.oscElements['lfo-fadeout'].setRange(LFO_FADER);
    
    new OSCTempo(document.getElementById('lfo-sync'))
      .bypassable = zsession.oscElements['lfo-frequency'];
    
   
    zsession.initLFOEditor = true;
  }
  
  //fill paths
  ['lfo-cont','lfo-type',...knobs].forEach( (id) => {
    let obj = zsession.oscElements[id];
    obj.oscpath = `${path}/${obj.HTMLElement.dataset.partial}`;
  });
  
  zsession.oscElements['lfo-sync'].setOscPath(path);
  
  let section = document.getElementById('synth-lfo-editor');
  
 
   //section.dataset.back = backTo;
  osc_synch_section(section,true).then( () => {
    return zsession.oscElements['lfo-sync'].sync();
  }).then( ()=>{
    loadSection('synth-lfo-editor', true);
  });
  
}

function onFilterEditorCategoryChange(ev) {
  let index = (ev.detail == null)
    ? ev.target.options[ev.target.selectedIndex].value
    : Object.values(ev.detail)[0][0];
  
  if (index < 0) index = 0;
  
  let obj = zsession.oscElements['filter-type'];
  let types = FILTER_TYPES[index];
  obj.setOptions([...Array(types.length).keys()], types);
  obj.oscpath = `${obj.path}/${FILTER_TYPE_PARTIAL[index]}`;
  obj.sync();  
}

function loadFilterEditor (title, enabled, path, lfo, envelope) {
  if (zsession.initFilterEditor === undefined){
     
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
    
   
    zsession.initFilterEditor = true;
  }
  
 
  Array.from(document.querySelectorAll('#synth-edit-filter .osc-element'))
      .map ( (el)=>el.id)
      .filter ( (id =>  id != 'filter-type'))
      .forEach( (id) => {
        let obj = zsession.oscElements[id];
        obj.oscpath = `${path}/${obj.HTMLElement.dataset.partial}`;
  });
  
  zsession.oscElements['filter-type'].oscpath = null;
  
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
  //section.dataset.back = backto;
  osc_synch_section(section,true).then ( () => {
    loadSection('synth-edit-filter',true);
  });
}

function loadAmplitudeEditor(title, lfo, envelope){
  if (zsession.initAmplitudeEditor === undefined){
    new OSCKnob(document.getElementById('amp-volume'),
      null, { 'min': -60, 'max' : 0, 'type': 'Volume (hz)', 'itype': 'f'});
    
    ['amp-panning', 'amp-delay', 'amp-punch', 'amp-punch-time']
      .forEach ( (id) => new OSCKnob(document.getElementById(id)));
    
    new OSCBoolean (document.getElementById('amp-bypass-global'));
    
    zsession.initAmplitudeEditor = true;
  }
  

  //bp and delay only on ad single voice
  let useBypassAndDelay = 
    zsession.synthID == 'ad' &&
    zsession.voiceID != ADSYNTH_GLOBAL;
    
  
  // Bypass and delay
  showIf( 'amp-bypass-global', useBypassAndDelay);
  showIf( 'amp-delay', useBypassAndDelay);
  zsession.oscElements['amp-bypass-global'].setEnabled(useBypassAndDelay);
  zsession.oscElements['amp-delay'].setEnabled(useBypassAndDelay);
  
  //Punch time & strength
  let usePunch = 
    (zsession.synthID != 'sub' &&
      zsession.voiceID == ADSYNTH_GLOBAL);
  
  showIf( 'amp-punch' ,usePunch);
  showIf( 'amp-punch-time', usePunch);
  zsession.oscElements['amp-punch'].setEnabled(usePunch);
  zsession.oscElements['amp-punch-time'].setEnabled(usePunch);
  
  
  let volumeObj = zsession.oscElements['amp-volume'];
  
  switch (zsession.synthID) {
    case 'ad' : 
      volumeObj.oscpath =  (zsession.voiceID == ADSYNTH_GLOBAL)
          ? '/synthcursor/Volume' : '/synthcursor/volume';
    break;
    case 'sub': volumeObj.oscpath = '/synthcursor/Volume'; break;
    case 'pad': volumeObj.oscpath = '/synthcursor/PVolume'; break;
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
  
  osc_synch_section(section).then ( ()=>{
    loadSection('synth-edit-amp',true);
  });
}

function loadHarmonicsEditor(name, data, type, path) {
  const labels = ['SINE','COS', 'UP', 'DOWN', 'FLAT', 'RANDOM'] ;
  if (zsession.initHarmonicsEditor === undefined) {
    let obj = zsession.elements['hgen-type'] = new Swipeable(
      document.getElementById('hgen-type'));
      obj.setOptions([...Array(6).keys()],
      labels);
    
    new InertKnob(document.getElementById('hgen-offset'), 
      {'min':0,'max':31, 'type': 'wave start', 'itype': 'i'});
      
    new InertKnob(document.getElementById('hgen-q'),
      {'min':0.1,'max':2, 'type': 'Exponential', 'itype': 'f'});
    
    document.getElementById('hgen-generate').addEventListener
      ('click', onHarmonicsEditorGenerate);
      
    zsession.initHarmonicsEditor = true;
  }
  
  zsession.elements['hgen-type'].setValue(labels.indexOf(data.alg));
  zsession.elements['hgen-q'].setValue(data.power);
  zsession.elements['hgen-offset'].setValue(data.offset);

  let section = document.getElementById('subsynth-harmonics');
  section.dataset.path = path;
  section.dataset.type = type;
  
  loadSection('subsynth-harmonics');
}

function onHarmonicsEditorGenerate(event) {
  let section = document.getElementById('subsynth-harmonics');
  let path = section.dataset.path;
  
  new ZynthoREST().post( 'subsynth', {
      'path' : path,
  //    'type' : type,
      'alg' : parseInt(
        zsession.elements['hgen-type'].getValue()
        ),
      'power' : parseFloat(
        zsession.elements['hgen-q'].getValue()
      ),
      'offset' : parseInt(
        zsession.elements['hgen-offset']
        .getValue())
  }).then ( ()=>{
    displayOutcome('Harmonics generated');
  });
}
