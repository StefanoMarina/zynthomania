/**
 * Envelope point
 * a point may have a path or a fixed number
 * when xxxpath is null, number is considered fixed
 * see OSCEnvelope
 */
class EnvPoint {
  constructor(label, X, Y) {
    this.label = label;
    this.time = (isNaN(X)) ? 0 : X,
    this.value = (isNaN(Y)) ? 0 : Y,
    this.timepath = (!isNaN(X)) ? null : X,
    this.valuepath = (!isNaN(Y)) ? null : Y
  }
}

/**
 * Envelope class
 * Manages points and converts values
 * This is a mother class
 */
class Envelope {
  constructor (...points) {
    this.points = Array.from(points);
    this.sustain = Math.ceil(this.points.length /2);
  }
  
  length() {
    return this.points
   //   .filter( point => !point.disabled)
      .map ( point => point.time )
      .reduce ( (acc, val) => acc+val, this.points.length);
  }
  
  convertPoints(width, height) {
    let W_RANGE = {'min': 0, 'max' : width, 'itype' : 'i' };
    let H_RANGE = {'min': 0, 'max' : height, 'itype' : 'i' };
    let ENV_TIME = {'min': 0, 'max' : this.length(), 'itype': 'i'};
    
    let VAL_TO_Y = (val) => {return (height) - convert_value(CC_RANGE,H_RANGE,val)};
    let TIME_TO_X = (time) =>  { return  convert_value(ENV_TIME,W_RANGE,time) };
    
    let cursor = 0;
    let result = [];
    return this.points.map ( (point) => {
      let obj=  ({
      'pos' : [ TIME_TO_X(point.time), VAL_TO_Y(point.value) ]
      });
      
      if (point.timepath)
        obj.label = String(point.time);
      if (point.valuepath)
        obj.label = (obj.label)
          ? `${obj.label}/${point.value}`
          : String(point.value);
      
      if ( point.disabled ) { obj.disabled = true;  obj.style = 'gray' };
      
      cursor += parseInt(TIME_TO_X(point.time));
      return obj;
    });
  }
}

/**
 * VCO Envelope has Attack/value/time nad Release/value/time
 */
class VCOEnvelope extends Envelope {
  constructor(path) {
    super ( 
      new EnvPoint('Start value', 0, `${path}/PA_val`),
      new EnvPoint('Attack time', `${path}/PA_dt`, 64),
      new EnvPoint('', 0, 64),
      new EnvPoint('Release', `${path}/PR_dt`, `${path}/PR_val`)
    );
    this.points[2].disabled = true;
    this.sustain = 2;
  }
  
  length() { return 258; }
  convertPoints(width, height) {
    
    //max width should be around 75%
    let maxWidth = Math.floor(width*0.75);
    let poles = super.convertPoints(maxWidth, height);
    
    //sustain length from 25% to full
    poles[this.sustain].pos[0] = Math.max(
      Math.floor(width*0.25),
      width - poles.reduce ( (acc, p) => acc + p.pos[0], 0 )
    );
    
   // poles[0].label = ;
    poles[this.sustain].label =  'Sus.';
    poles[this.sustain+1].style = 'black';
    return poles;
  }
}

class VCAEnvelope extends Envelope {
  constructor(path) {
    super(
      new EnvPoint('', 0, 0),
      new EnvPoint('Attack', `${path}/PA_dt`, 127),
      new EnvPoint('Decay/Sustain', `${path}/PD_dt`, `${path}/PS_val`),
      new EnvPoint('', 0, 0),
      new EnvPoint('Release', `${path}/PR_dt`, 0 )
    );
    
    this.sustain = 3;
    this.points[this.sustain].disabled = this.points[0].disabled = 1;
  }
  
  length () { return 512; }
  
  convertPoints(width, height) {
    //max width should be around 75%
    let maxWidth = Math.floor(width*0.75);
    let poles = super.convertPoints(maxWidth, height);
    
    //sustain length from 25% to full
    poles[this.sustain].pos[0] = Math.max(
      Math.floor(width*0.25),
      width - poles.reduce ( (acc, p) => acc + p.pos[0], 0 )
    );
    poles[this.sustain].pos[1] = poles[this.sustain-1].pos[1];
    
    poles[this.sustain].label =  'Sus.';
    poles[this.sustain].style =  'gray';
    poles[this.sustain+1].style = 'black';
    return poles;
  }
}

class VCFEnvelope extends Envelope {
  constructor(path, filter) {
    super( 
      new EnvPoint('Start', 0, `${path}/PA_val`),
      new EnvPoint('Attack', `${path}/PA_dt`, `${path}/PD_val`),
      new EnvPoint('Decay/Sustain', `${path}/PA_dt`, filter),
      new EnvPoint('', 0,0),
      new EnvPoint('Release', `${path}/PR_dt`, `${path}/PR_val`)
    );
    
    this.sustain = 3;  
    this.points[this.sustain].disabled  = 1;
  }
  
  length () { return 512; }
  
  convertPoints(width, height) {
    //max width should be around 75%
    let maxWidth = Math.floor(width*0.75);
    let poles = super.convertPoints(maxWidth, height);
    
    //sustain length from 25% to full
    poles[this.sustain].pos[0] = Math.max(
      Math.floor(width*0.25),
      width - poles.reduce ( (acc, p) => acc + p.pos[0], 0 )
    );
    
    poles[this.sustain].label =  'Sus.';
    poles[this.sustain].style =  'gray';
    poles[this.sustain+1].style = 'black';
    poles[this.sustain].pos[1] = poles[this.sustain-1].pos[1];
    return poles;
  }
}
