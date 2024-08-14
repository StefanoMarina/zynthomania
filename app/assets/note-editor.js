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

class NoteEditor {
  constructor() {
    this.dialog = document.getElementById('note-editor');
    this.octaveSlider = document.getElementById('note-editor-slider');
    this.selection = document.getElementById('note-editor-selection');
    
    //init
    this.octaveSlider.addEventListener('change', () => {
        this.dialog.dataset.value = '';
        document.getElementById('note-editor-slider-label')
          .innerHTML = this.octaveSlider.value;
    });
  }
  
  areaSelectNodeCallback(event) {
    let SELF = window.zsession.noteEditor;
    
    let areaNote = event.target;
    let octave = parseInt( SELF.octaveSlider.value );
    let note  = parseInt(areaNote.dataset.note);
    
    //noteEditorSetSelection(note);
    SELF.setSelection(note);
    SELF.selection.innerHTML = NOTES[note]+(octave);
    
    let midiCode = note+(octave*12);
    SELF.dialog.dataset.selection=midiCode;
  }

  /*
   * Open the note editor dialog
   */
  showNoteEditor(value, onOk, onCancel) {
    let nodes = this.dialog.querySelectorAll('area');
    
    //add note selection event listener
    nodes.forEach( (areaNote) => {
      areaNote.addEventListener('click', this.areaSelectNodeCallback);
    });
    
    if (value !== undefined) {
      this.setOctave(Math.floor(value / 12));
      this.setSelection(value);
    }
    
    document.getElementById('note-editor-ok').addEventListener('click', (ev) =>{
      //close and call
      this.dialog.open=false;
      
      if (onOk !== undefined)
        onOk(this.dialog.dataset.selection);
    }, {once: true});
    
    document.getElementById('note-editor-cancel').addEventListener('click', (ev) =>{
      //close and call
      this.dialog.open=false;
      
      if (onOk !== undefined)
        onCancel();
    }, {once: true});
    
    this.dialog.open=true;
  }


/*
 * Display octave
 */
  setOctave (noteOctave) {
    this.octaveSlider.value = noteOctave;
    this.octaveSlider.dispatchEvent(new Event('change'));
    //document.getElementById('note-editor-slider-label').innerHTML = noteOctave;
  }

  /*
   * Shows midi code
   */
  setSelection(value = undefined) {
    if (value !== undefined) {
      let noteOctave = Math.floor(value / 12);
      let noteValue = value - ( (noteOctave)*12);
      let noteCode = NOTES[noteValue]+(noteOctave);
     
      this.selection.innerHTML = noteCode;
      document.getElementById('piano-editor').src= `piano-editor/piano_${noteValue}.svg`;
      
    } else {
      document.getElementById('piano-editor').src=
        'piano-editor/piano_none.svg';
      this.selection.innerHTML = '---';
    }
  }

}

function loadNoteEditor(min, max, value, mode="note") {
  let nodeSection = document.getElementById('note-editor');
  
  let octaveSlider = document.getElementById('note-editor-slider');
  octaveSlider.min = min;
  octaveSlider.max = max;
  
  let currentSectionID = document.querySelector('section.opened');
  nodeSection.dataset.back = currentSectionID.ID;
  
  if (undefined === window.zsession['note-editor-initialized']) {
      octaveSlider.addEventListener('change', () => {
        nodeSection.dataset.value = '';
        document.getElementById('note-editor-slider-label')
          .innerHTML = octaveSlider.value;
      });
      window.zsession['note-editor-initialized'] = true;
   }
  
  nodeSection.dataset.mode = mode;
  //enable note selector
  if (mode === "note") {
    let nodes = nodeSection.querySelectorAll('area');
    
    //add note selection event listener
    nodes.forEach( (areaNote) => areaNote.addEventListener( 'click',  () => {
      let octave = parseInt(
        document.getElementById('note-editor-slider').value);
      let note  = parseInt(areaNote.dataset.note);
      
      noteEditorSetSelection(note);
      document.getElementById('note-editor-selection').innerHTML 
          = NOTES[note]+(octave);
      
      let midiCode = note+(octave*12);
      document.getElementById('note-editor').dataset.selection=midiCode;
    }));
  }
  
  //set value
  if (value !== undefined) {
    noteEditorSetOctave(Math.floor(value / 12));
    noteEditorSetSelection(value);
  }
  
  //loadSection('note-editor');
  nodeSection.open = true;
}

function noteEditorSetOctave(noteOctave) {
  document.getElementById('note-editor-slider').value = noteOctave;
  document.getElementById('note-editor-slider-label').innerHTML = noteOctave;
}

//shows a value
function noteEditorSetSelection(value) {
  if (value !== undefined) {
    let noteOctave = Math.floor(value / 12);
    let noteValue = value - ( (noteOctave)*12);
    let noteCode = NOTES[noteValue]+(noteOctave);
   
    document.getElementById('note-editor-selection').innerHTML = noteCode;
    document.getElementById('piano-editor').src=
      `piano-editor/piano_${noteValue}.svg`;
    
  } else {
    document.getElementById('piano-editor').src=
      'piano-editor/piano_none.svg';
    document.getElementById('note-editor-selection').innerHTML = '---';
  }
}

function noteEditorNoteOff(){
  let nodeSection = document.getElementById('note-editor');
  if (nodeSection.dataset.mode == 'note') {
    nodeSection.dataset.selection = '';
    noteEditorSetSelection(undefined);
  }
}
