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

/**
 * OSC Values and converters
 */

function OSC_BOOL(bool) { return (bool || bool === 'T') ? 'T' : 'F'; } 

//auto create an array from 0 to length
function OSC_INT_PARAM(length) { return Array.from(Array(length).keys()); }
    
/*
 * We will follow piano notation
 * so Midi 21 = A0
 * Midi 36 = C2
 */
const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const EQ_RANGES = {
  '30': 6,  '40': 14,  '50': 18,  '60': 20,  '70': 23,  '80': 27,
  '90': 28, '100' : 30, '150' : 37, '200' : 46, '300' : 50, '400': 57,
  '500' : 60, '600': 63, '700': 67, '800': 70, '900' : 71,
  '1k' : 73, '1.5k': 80, '2k' : 87, '2.5k': 90, '3k' : 95, '3.5k' : 97,
  '4k' :100, '5k' : 102, '6k' : 108, '7k': 110, '8k' : 113, '9k' : 116,
  '10k' : 117
}
  
const CC_RANGE = {
  'type' : 'midi cc',
  'min' : 0,
  'max':  127,
  'itype' : 'i'
};

const BOOL_RANGE = {
  'type' : 'boolean (T|F)',
  'min' : 0,
  'max' : 1,
  'itype' : 'i'
};

const BEND_RANGE = {
  'type' : '% of semitone',
  'min' : -6400,
  'max' : 6400,
  'itype' : 'i'
};

const SEMITONE = {
  'type': 'CC semitone',
  'min' : -64,
  'max' : 63,
  'itype' : 'i',
}

const BALANCE = {
  'type': 'Balance',
  'min' : -64,
  'max' : 63,
  'itype' : 'i',
}

const KNOB_DEGREE = {
  'type' : 'degree',
  'min': 30,
  'max': 328,
  'itype' : 'i'
}

const PITCH_CONTROL = {
  'min' : 0,
  'max': 16383,
  'itype': 'i'
}

const OCTAVE = {
  'type' : 'octave',
  'min': -8,
  'max': 8,
  'itype' : 'i'
}

const L35_TUNE = {
  'type' : '% of .35',
  'min': -35,
  'max': 35,
  'itype' : 'f'
}

const L10_TUNE ={
  'type' : '% of .10',
  'min': -10,
  'max': 10,
  'itype' : 'f'
}

const E100_TUNE ={
  'type' : '% of tone',
  'min': -100,
  'max': 100,
  'itype' : 'f'
}

const E1200_TUNE ={
  'type' : '% of tone (octave)',
  'min': -1200,
  'max': 1200,
  'itype' : 'f'
}

const HERTZ = {
  'type' : 'Frequency (hz)',
  'min' : 0.08,
  'max' : 85.25,
  'itype' : 'f',
  fromBPM : function (bpm) { return bpm/60; }
}

const FILTER_RANGE = { 
  'min': 31.25,
  'max': 32000.0,
  'type': 'Frequency', 
  'itype': 'f' 
}

const LFO_FADER = {
  'type' : 'seconds (partial)',
  'min' : 0,
  'max' : 10,
  'itype': 'f'
}

const PERCENTAGE_F = {
  'type': 'Percent',
  'min': 0,
  'max': 100.0,
  'itype': 'f'
}

const BYTE_RANGE = {
  'type' : 'Value',
  'min': 0,
  'max' : 255,
  'itype' : 'i'
}

const ENVELOPE_RANGE = {
  'type' : 'Seconds',
  'min' : 0,
  'max' : 41,
  'itype': 'f'
}

function toRange(number) {
  let itype= Number.isInteger(number) ? 'i' : 'f';
  return {'min': 0, 'max' : number, 'itype' : itype};
}

function convert_value(A,B,value) {
  if (A === B) return value;
  
  let res = (value-A.min) / (A.max-A.min) * (B.max-B.min) + B.min;
  return ( B.itype == 'i') ? Math.round(res) : toFixed(res,2);
}

function midiNote(value) {
  if (isNaN(value)) {
    let results = /([A-G]\#?)(\d+)/.exec(value);
    let note = results[1];
    let octave = parseInt(results[2]);
    return { 
      'note' : note, 
      'octave' : octave, 
      'code' : NOTES.indexOf(note)+(octave*12),
      'str' : value
    };
  } else {
    let octave = Math.floor(value/12);
    let note = value-(octave*12);
    return { 
      'note': NOTES[note],
      'octave': octave,
      'code': value,
      'str': NOTES[note]+(octave)
    };
  }
}
