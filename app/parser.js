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

const SimpleTextParser = require ('simple-text-parser');

/**
 * TODO:
 * Inheritance would be better because allows more flex - I think?
 */

var exports = module.exports = {};

exports.OSCParser = class {
  constructor() {
    
    this.sanitizer =  new SimpleTextParser.Parser();
    /**
     * todo
     * add path sanitizer
    this.sanitizer.addRule(/\/[\w\d ]+(?=[\/\[\d ])/gmi, function (tag) {
      //sanitize path from spaces
      return tag.replaceAll(' ', '');
    });
    */
    
    this.sanitizer.addRule(/\ ?[[\d ,]+ ?\]/gmi, function (tag) {
      //Sanitize path array
      return tag.replaceAll(' ', '');
    });
    
    this.pathParser = new SimpleTextParser.Parser();
    
  
    //iterations
    this.pathParser.addRule(/(\/[^\[]+)\[(\d+)-(\d+)\]/gmi, function (tag, clean_path, from, to) {
       
       //return {type: 'iteration', from: from, to: to, text: text};
       let nodes = [];
       for (let i = from; i < parseInt(to)+1; i++) {
         nodes.push(clean_path+i);
       }
       
       return {type: 'multiple', nodes: nodes, current: 0}
    });
    
    //groups
    this.pathParser.addRule(/(\/[^\[]+)\[([\d,]+)\]/gmi, function (match, path, numbers) {
       let indexes = numbers.split(',');
       
       let nodes = [];
       indexes.forEach( (index) => {nodes.push (path+index)} )
       
       return {type: 'multiple', nodes: nodes, current: 0, numbers: indexes}
       //return {type: 'array', group: indexes , text: path};
    });
    
    
    //simple no arguments
    this.pathParser.addRule(/^\/[^\[]+$/gmi, function (tag) {
      return {type: 'simple', text: tag};
    })
    
    //simple
    this.pathParser.addRule(/(\/[\w\d]+)/gmi, function (tag) {
      return { type: 'simple', text: tag};
    })
    
    //Argument parser
    this.argParser = new SimpleTextParser.Parser();
    
    this.argParser.addRule(/[\"\']([^\"\']+)[\"\']/gmi, function(full, string) {
      return { type: 's', value : string };
    });
    
    this.argParser.addRule(/(^|[^\w])([TF])( +|$)/gm, function(full, before, string) {
      let value = (string == 'T');
      console.log('test');
      console.log('test');
      return {type: string, value: value};
    });
    
    this.argParser.addRule(/(\d+[ ,.]+\d+)( +|$)/gm, function(value, float) {
      return {type: 'f', value: float}
    });
    
    this.argParser.addRule(/(\d+)( +|$)/gm, function(value, number) {
      return {type: 'i', value: parseInt(number)}
    });
  }
  
  /**
   * Sanitizes path (ie removes white spaces)
  */
  sanitize(line) { return this.sanitizer.render(line); }
   
  
  /**
   * Split into mother/children nodes
   * called recursively
   * returns: nodes
   */
  createTree(mother, index) {  
     //no new nodes
     if (index >= this.lastResult.nodes.length)
      return mother;
     
     let currentNode = this.lastResult.nodes[index];
     
     if (currentNode.type == 'multiple') {
        currentNode.nodes.forEach( (node) => {
           let child = {value : node, children: [] };
           child = this.createTree(child, index+1);
           mother.children.push(child);
        });
     } else if (currentNode.type == 'simple') {
       mother.children.push ( {value: currentNode.text});
       //next sibling
       return this.createTree(mother, index+1);
     }
     
     return mother;
  }
  
  
  /**
    * Translates a line into a OSC.js object
  */
  translate(line) {
    let sanitizedLine = this.sanitize(line);
     
    //let groups = line.match('/(\/[^ ]+) *(.*)?/gm');
    let OSCRegex = RegExp('(\/[^ ]+) *(.*)?','gm');
    let groups = OSCRegex.exec(sanitizedLine);
    
    if (groups === undefined || groups == null)
      throw `Invalid OSC path '${line}'`;
    
    //Reset lastResult
    this.lastResult = { raw: line , path: groups[1]}
    
    //split string into nodes
    this.lastResult.nodes = this.pathParser.toTree(groups[1]);
    
    //turn nodes into DOM
    this.lastResult.tree = this.createTree({root : true, children: []}, 0)
    
    //translate arguments
    if (groups[2] !== undefined) {
      this.lastResult.args = this.argParser.toTree(groups[2]);
    }
    
    //build addresses
    this.lastResult.result = 
      this.render(undefined, this.lastResult.tree, [])
      
    if (this.lastResult.result.length == 1) {
      return this.lastResult.result[0];
    } else {
      return {
        timeTag: {raw: [0,1], native: Number},
        packets: this.lastResult.result
      }
    }
  }
  
  render(prefix, node, result) {
    let currentPrefix = (node.root !== undefined) ? '' : prefix+node.value;
    
    if (node.children !== undefined && node.children.length > 0) {
      node.children.forEach( (child) => {
        result = this.render(currentPrefix, child, result);
      })
    } else {
      result.push( (this.lastResult.args !== undefined)
           ? {address: currentPrefix, args: this.lastResult.args}
           : {address: currentPrefix, args: [] } 
      );
    }
    
    return result;
  }
  
  emptyBundle() {
    return {
        timeTag: {raw: [0,1], native: Number},
        packets: []
      }
  }
}
