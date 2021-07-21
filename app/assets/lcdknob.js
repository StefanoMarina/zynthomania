/*********************************************************************
(c) Copyright 2021 by Stefano Marina.

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject
to the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR
ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
**********************************************************************/

class LCDKnob {
  constructor(id) {
    this.value = 0;
    this.divID = id;
    //let svg = $(`#${this.divID} svg`);
    //$(svg).attr('height', 50).attr('width', 50);
    //$(svg).append('<line x1="25" y1="25" x2="25" y2="0" style="stroke:rgb(128,128,128); stroke-width:2" />');
    
  }
  
  setValue(value) {
    this.value = Math.min(127, (Math.round(value/32*32) % 159 ) ) ;
    
   // console.log('new value :' + this.value);
    this.render();
    return this.value;
  }
  
  getValue() {
    return this.value;
  }
  
  next() {
    return this.setValue(this.getValue()+32);
  }
  
  render() {
    //let percentage = (this.value / 127)*360;
    //$(`#${this.divID} > div`).css('tranform', `rotate(${percentage})`);
    document.getElementById(this.divID).innerHTML = `<b>${ ('000'+this.value).substr(-3) }</b>`;
  }
}
