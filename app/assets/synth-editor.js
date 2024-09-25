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
   let osc = new OSCSwipeable(__ID('freq-detune-type'),
      [...Array(4).keys()],
      ['L. 35c', 'L. 10c', 'Ex. 100c', 'E. 1200c'],
      {'title': 'Select detune range'});
  
   osc.HTMLElement.querySelector('select')
    .addEventListener('change', onFreqEditChangeTune);
    
    osc = new OSCKnob(__ID('freq-detune'));
    osc.serverRange = PITCH_CONTROL;
    
    new OSCKnob(__ID('freq-coarse'),undefined,
      SEMITONE);
    
    new OSCKnob(__ID('freq-octave'),undefined,
      OCTAVE);
    
    new OSCBoolean(__ID('freq-para'));
    
    zsession.initFrequencyEditor = true;
  }
  
  let section = __ID('synth-frequency-editor');
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
  
  
  let el = __ID('freq-open-lfo');
  if (lfo != null) {
    el.classList.remove('hidden');
    el.addEventListener('click', lfo);
  } else {
    el.classList.add('hidden');
  }
  
  el = __ID('freq-open-envelope');
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

function loadEnvelopeEditor(title, unused, path, type, filter=null) {
  
  if (zsession.initADSREditor === undefined) {
    new OSCBoolean(__ID('adsr-forced-release'));
    new OSCKnob(__ID('adsr-stretch'));
    new OSCEnvelope(__ID('synth-envelope-graph'));
    
    zsession.initADSREditor = true;
  }
  
  let section = __ID('synth-envelope-editor');
  section.dataset.title=title;
   
  zsession.oscElements['synth-envelope-graph'].setEnvelope(path, type, filter);
  
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
    new OSCBoolean(__ID('lfo-cont'));
    
    new OSCSwipeable(__ID('lfo-type'),
    [...Array(8).keys()],
    ['Sine','Triangle','Square','RampUp','RampDo','E1dn','E2dn','Random'],
    {'title':'Lfo Type'}
    );
    
      knobs. forEach( (id)=> {
          let obj = new OSCKnob(__ID(id));
      });
    
    zsession.oscElements['lfo-frequency'].setRange(HERTZ);
    
    zsession.oscElements['lfo-delay'].setRange(
      { 'min': 0, 'max': 4.0,
        'type': 'centisecs to start', 'itype': 'f'}
    );
    
   
    zsession.oscElements['lfo-fadein'].setRange(LFO_FADER);
    zsession.oscElements['lfo-fadeout'].setRange(LFO_FADER);
    
    new OSCTempo(__ID('lfo-sync'))
      .bypassable = zsession.oscElements['lfo-frequency'];
    
   
    zsession.initLFOEditor = true;
  }
  
  //fill paths
  ['lfo-cont','lfo-type',...knobs].forEach( (id) => {
    let obj = zsession.oscElements[id];
    obj.oscpath = `${path}/${obj.HTMLElement.dataset.partial}`;
  });
  
  zsession.oscElements['lfo-sync'].setOscPath(path);
  
  let section = __ID('synth-lfo-editor');
  
 
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
     
    let swipe = new OSCSwipeable (__ID('filter-category'),
      [0,2,3,4],
      ['Analog', 'St. Var.', 'Moog', 'Comb'],
      {'title': 'Filter category'}
    );
    
    swipe.selectElement.addEventListener('change',onFilterEditorCategoryChange);
    swipe.HTMLElement.addEventListener('sync',onFilterEditorCategoryChange);
    
    new OSCSwipeable (__ID('filter-type'),
      [], [], {'title': 'Filter type', 'buttonClass': 'col-6'})
        .path = path;
        
    new OSCKnob(__ID('filter-stages'), null,
      { 'min': 1, 'max': 5, 'type': 'Filter stages', 'itype': 'i' }
    );
    
    new OSCKnob(__ID('filter-gain'), null,
      { 'min': -30.0, 'max': 30.0, 'type': 'Gain', 'itype': 'f' }
    );
    new OSCKnob(__ID('filter-basefreq'), null,
      FILTER_RANGE
    );
    new OSCKnob(__ID('filter-q'), null,
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
  
  let elementLFO = __ID('filter-edit-lfo');
  if (lfo) {
    elementLFO.classList.remove('hidden');
    elementLFO.addEventListener('click', lfo);
  } else{
    elementLFO.classList.add('hidden');
  }
  let elementEnvelope = __ID('filter-edit-envelope');
  if (envelope) {
    elementEnvelope.classList.remove('hidden');
    elementEnvelope.addEventListener('click', envelope);
  } else{
    elementEnvelope.classList.add('hidden');
  }

  let section = __ID('synth-edit-filter');
  section.dataset.title = title;
  //section.dataset.back = backto;
  osc_synch_section(section,true).then ( () => {
    loadSection('synth-edit-filter',true);
  });
}

function loadAmplitudeEditor(title, lfo, envelope) {
  if (zsession.initAmplitudeEditor === undefined){
    new OSCKnob(__ID('amp-volume'),
      null, { 'min': -60, 'max' : 0, 'type': 'Volume (hz)', 'itype': 'f'});
    
    ['amp-panning', 'amp-delay', 'amp-punch', 'amp-punch-time']
      .forEach ( (id) => new OSCKnob(__ID(id)));
    
    new OSCBoolean (__ID('amp-bypass-global'));
    
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
  
  let elementLFO = __ID('amp-edit-lfo');
  if (lfo) {
    elementLFO.classList.remove('hidden');
    elementLFO.addEventListener('click', lfo);
  } else{
    elementLFO.classList.add('hidden');
  }
  let elementEnvelope = __ID('amp-edit-envelope');
  if (envelope) {
    elementEnvelope.classList.remove('hidden');
    elementEnvelope.addEventListener('click', envelope);
  } else{
    elementEnvelope.classList.add('hidden');
  }
  
  let section = __ID('synth-edit-amp');
  section.dataset.title = title;
  
  osc_synch_section(section).then ( ()=>{
    loadSection('synth-edit-amp',true);
  });
}

function loadOscillatorEditor(title, oscillator, useNoise) {
   if (zsession.initSynthOSC === undefined) {
    
    /* synth-osc-wave is a representation of an OSC bundle actually */
    let swipe = new Swipeable(__ID('synth-osc-wave'));
    swipe.setOptions( [...Array(18).keys(),19,20],
      ['Sine','Triangle','Pulse','Saw','Power','Gauss','Diode','Abs.Sine',
        'Pulse Sine','Stch.Sine', 'Chirp', 'Abs.Stch.Sine', 'Chebyshev',
        'Square','Spike','Circle', 'Power sinus', 'Custom', 'White noise','Pink noise' ]
    );
    swipe.setDialogData({ 'title' : 'Select base wave', 'buttonClass': 'col-6 col-lg-4'});
    
    swipe.selectElement.addEventListener('change', (ev) => {
      let value = ev.target.options[ev.target.selectedIndex].value;
      let typeValue = Math.max(0, value - 18);
      
      swipe.bundle.act([value,typeValue]);
      if (!useNoise)
        return;
      
      if (typeValue > 0) {
        //disable all controls
        Array.from( __ID('section-synth-osc').querySelectorAll('.osc-element'))
          .map ( (el) => el.id)
          .forEach ( (id) => {zsession.oscElements[id].setEnabled(false)});
      } else {
        Array.from( __ID('section-synth-osc').querySelectorAll('.osc-element'))
          .map ( (el) => el.id)
          .forEach ( (id) => {zsession.oscElements[id].setEnabled(true)});
        zsession.oscElements['synth-osc-robot'].setEnabled(
            zsession.synthID != 'pad');
      }
    });
  
    swipe.bundle =new OSCBundle(['/osccursor/Pcurrentbasefunc']);
    swipe.bundle.addEventListener('sync', (data) => {
      console.log('called change event');
      let swipe = zsession.elements['synth-osc-wave'];
      let paths = Object.keys(data);
      if (paths.length == 1){
        swipe.setSelection(data[paths[0]][0]);
      } else { 
        let pathSource = paths.filter( (p)=>p.endsWith('Type'))[0];
        let otherPath = paths[
          paths.indexOf(pathSource)==0 ? 1 : 0
        ];
        let sourceVal = parseInt(data[pathSource][0]);
        if (sourceVal > 0)
          swipe.setSelection(17+sourceVal);
        else
          swipe.setSelection(data[otherPath][0]);
      }
    });
    zsession.elements['synth-osc-wave'] = swipe;
    
    let wavep = new OSCKnob(__ID('synth-osc-wave-p'),
      undefined, BALANCE);
    wavep.serverRange = CC_RANGE;
    
    new OSCSwipeable(__ID('synth-osc-shaper'),
      [...Array(18).keys()],
      ['None', 'Arc Tang.', 'Asymmetric', 'Pow', 'Sine', 'Quantis.', 'Zigzag',
        'Limiter', 'Up Limit', 'Low limit', 'Inverse Lim.', 'Clip', 'Asym2', 'Pow2', 'Sigmoid',
        'TanH','Cubic','Square' ],
      { 'title': 'Select shaper', 'buttonClass': 'col-6 col-lg-4'}
      );
    new OSCKnob(__ID('synth-osc-shaper-p'));
      
    new OSCSwipeable(__ID('synth-osc-h'),
      [...Array(9).keys()],
      ['Off', 'On', 'Square', '2xSub','2xAdd', '3xSub', '3xAdd',
        '4xSub', '4xAdd'],
      { 'title': 'Select harmonics', 'buttonClass': 'col-4 col-lg-3'}
      );
    new OSCKnob(__ID('synth-osc-h-f'),undefined,
      {'type': 'Harmonic frequency', 'min' : 0, 'max' : 255, 'itype': 'i'} );
    new OSCKnob(__ID('synth-osc-h-p'),undefined,
      {'type': 'Harmonic power', 'min' :0, 'max' : 200, 'itype': 'i'} );
    new OSCKnob(__ID('synth-osc-h-r'),undefined,
      {'type': 'Power %', 'min' : 0, 'max' : 100, 'itype': 'i'} );
  
    new OSCGraph(__ID('synth-mag'),127);
      
      
    //H725 knob - replace random harmonics
    let element  = new OSCKnob(__ID('synth-osc-robot'));
      
    //T800 knob - replace base function modulation
    element = new OSCKnob(__ID('synth-osc-terminator'));
   
    //Robodevil knob - replace post modulation
    element = new OSCKnob(__ID('synth-osc-robodevil'));
 
    zsession.initSynthOSC = true;
  }
  
  //Update oscillator cursor
  zsession.osccursor = osc_sanitize(`synthcursor/${oscillator}`);
  
  var bChangedPart = false;
  if (zsession.synthID == 'ad' && zsession.voiceID == ADSYNTH_GLOBAL) {
    zsession.voiceID = 0;
    zsession.elements['adsynth-voice'].setSelection(1);
    
    bChangedPart = true; //setting for later as sync clears msg
  }
  
  //Enable/Disable tone vs noise selection
  let synthWaveBundle = zsession.elements['synth-osc-wave'].bundle;
  [18,19].forEach ( (i)=> 
    zsession.elements['synth-osc-wave'].selectElement.options[i]
    .enabled=useNoise );
    
  if ( useNoise && synthWaveBundle.oscpath.length == 1)
   synthWaveBundle.oscpath.push('/part/kit/adpars/voice/Type');
  else if (!useNoise && synthWaveBundle.oscpath.length == 2)
    synthWaveBundle.oscpath.pop();

  zsession.oscElements['synth-osc-robot'].setEnabled(
    zsession.synthID != 'pad');
    
  osc_synch_section(__ID('section-synth-osc')). then ( () => {
    console.log('requesting wave');
    return zsession.elements['synth-osc-wave'].bundle.sync();
  }).then( ()=> {
    console.log('synched wave');
    if (zsession.elements['synth-osc-wave'].selectElement.selectedIndex 
      > 17) {
      //disable all controls
      Array.from( document.querySelectorAll('#section-synth-osc .osc-element'))
        .map ( (el) => el.id)
        .forEach ( (id) => {zsession.oscElements[id].setEnabled(false)});
    } else {
      Array.from( document.querySelectorAll('#section-synth-osc .osc-element'))
        .map ( (el) => el.id)
        .filter ( (id) => id != null)
        .forEach ( (id) => {zsession.oscElements[id].setEnabled(true)});
         zsession.oscElements['synth-osc-robot'].setEnabled(
          zsession.synthID != 'pad');
    }
        
    if (bChangedPart)
      displayOutcome('Switching to adsynth voice #1');
      
    loadSection('section-synth-osc', true);
  });
}
