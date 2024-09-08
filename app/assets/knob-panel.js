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

function initKnobEditorDialog(){
   
  /*
   * Knob Editor Dialog
   */
  
  let knobEditorArea = document.getElementById('knob-editor-area');
  
  knobEditorArea.addEventListener('touchstart', (e) => {
    console.log("start");
    knobEditorArea.touchStartX = e.changedTouches[0].screenX;
    //knobEditorArea.touchStartY = e.changedTouches[0].screenY;
  });
  
  var logrot = document.getElementById('logrot');
  knobEditorArea.addEventListener('touchmove', (e) => {
    let startX = knobEditorArea.touchStartX;
    let currentX  = e.changedTouches[0].screenX;
    
    var SENS = 4;
    let range = currentX-startX;
    
    if ( Math.abs(range) < SENS) 
      return;
    
    //get rotation
    let rotation = 
      parseInt(knobEditorArea.style.rotate.slice(0,-3)) + range;
    rotation = 
      Math.min(  Math.max( KNOB_DEGREE.min, rotation ), 
        KNOB_DEGREE.max) ;
      
    knobEditorArea.style.rotate = rotation + "deg";
    
    let knobObject = window.zsession.oscElements[
      document.getElementById('knobEditor').dataset.knobID ];
    
    document.getElementById('knob-editor-value').value =
      knobObject.getRotationValue(rotation);
    
    //reset
    knobEditorArea.touchStartX = currentX;
    //logrot.innerHTML = ` R ${range} Rot ${rotation}`;
  });
  
  knobEditorArea.addEventListener('touchend', ()=> {
    let knobObject = window.zsession.oscElements[
      document.getElementById('knobEditor').dataset.knobID ];
    knobObject.act(document.getElementById('knob-editor-value').value);
  });
  
  //Initialize input editor
  document.getElementById('knob-editor-value').addEventListener('change',
  (e) => {
    let me = e.target;
    let knobObject = window.zsession.oscElements[
      document.getElementById('knobEditor').dataset.knobID ];

    knobObject.act(
      document.getElementById('knob-editor-value').value
    ).then( ()=> {
        knobEditorArea.style.rotate 
          = knobObject.knob.style.rotate;
    });
  });
}


/*
 * Loads the knob editor sectionn
 */
function loadKnobEditor(knobObject) {
  let knobEditorDialog = document.getElementById('knobEditor');
  let editorKnob = document.getElementById('knob-editor-area');
  
  //bind knob
  knobEditorDialog.dataset.knobID = knobObject.HTMLElement.id;
  editorKnob.style.rotate = knobObject.knob.style.rotate;
  
  document.getElementById('knob-editor-range').innerHTML
    = `Value is ${knobObject.range.type}, Range ${knobObject.range.min} to ${knobObject.range.max}`;
    
  document.getElementById('knob-editor-osc-path').innerHTML = 
    knobObject.getAbsolutePath();
    
  let input = document.getElementById('knob-editor-value');
  input.value=knobObject.knob.dataset.value;
  input.max = knobObject.range.max;
  input.min = knobObject.range.min;
  
  document.getElementById('knob-editor-title')
    .innerHTML = knobObject.label;
  //knobEditorDialog.dataset.title = ;
  /*
  let currentPanel = document.querySelector( 'section.opened');
  if (currentPanel == null)
    knobEditorDialog.dataset.back = 'section-intro';
  else
    knobEditorDialog.dataset.back = currentPanel.id;
  */
  //loadSection('knobEditor');
  knobEditorDialog.open = true;
}

function onKnobClose() {
  document.getElementById('knobEditor').open = false;
}

function onKnobBind() {
  let knobObject = window.zsession.oscElements[
      document.getElementById('knobEditor').dataset.knobID ];
  
  let range = knobObject.serverRange;
  
  let obj = {};
  if (range === CC_RANGE) {
    obj['fader'] = 'abs';
  } else {
    obj['fader'] = (range.itype == 'i') ? 'int' : 'float';
    obj['min'] = range.min;
    obj['max'] = range.max;
  }
  
  obj['osc'] = knobObject.getAbsolutePath();
  loadBindEditor(obj, true);
}

function onKnobMinus() {
  let knobObject = window.zsession.oscElements[
      document.getElementById('knobEditor').dataset.knobID ];
  
  let step = (knobObject.range.max - knobObject.range.min) / 8;
  if ( knobObject.range.itype == 'i')
    step = Math.round(step);
  else
    step = toFixed(step, 2);
    
  let input =  document.getElementById('knob-editor-value');
  let newval = Math.max ( knobObject.range.min, 
    parseFloat(input.value) - step);
  input.value = ( knobObject.range.itype == 'i') ? Math.round(newval)
    : toFixed(newval, 2);
  
  input.dispatchEvent(new Event('change'));
}

function onKnobPlus() {
  let knobObject = window.zsession.oscElements[
      document.getElementById('knobEditor').dataset.knobID ];
  
  let step = (knobObject.range.max - knobObject.range.min) / 8;
  if ( knobObject.range.itype == 'i')
    step = Math.round(step);
  else
    step = toFixed(step, 2);
    
  let input =  document.getElementById('knob-editor-value');
  let newval = Math.min ( knobObject.range.max, 
    parseFloat(input.value) + step);
  input.value = ( knobObject.range.itype == 'i') ? Math.round(newval)
    : toFixed(newval, 2);
  
  input.dispatchEvent(new Event('change'));
}

function onKnobReset() {
  let knobObject = window.zsession.oscElements[
      document.getElementById('knobEditor').dataset.knobID ];
  let input =  document.getElementById('knob-editor-value');
  let newval = ((knobObject.range.max-knobObject.range.min) / 2)
    + knobObject.range.min;
  input.value = ( knobObject.range.itype == 'i') ? Math.round(newval)
    : toFixed(newval, 2);
  input.dispatchEvent(new Event('change'));
}
