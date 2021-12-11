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
  
  next(val) {
    val = (val === undefined) ? 32 : val;
    return this.setValue(this.getValue()+val);
  }
  
  render() {
    if (this.divID instanceof jQuery)
      this.divID.text(`000${this.value}`.substr(-3));
    else
      document.getElementById(this.divID).innerHTML = `000${this.value}`.substr(-3);
  }
}
