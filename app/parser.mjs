import { Parser } from 'simple-text-parser';

//Parser = require ('simple-text-parser');
/**
 * TODO:
 * Inheritance would be better because allows more flex - I think?
 */
class OSCParser {
  constructor() {
    
    this.sanitizer =  new Parser();
    
    this.sanitizer.addRule(/\/[\w\d ]+(?=[\/\[\d ])/gmi, function (tag) {
      //sanitize path from spaces
      return tag.replaceAll(' ', '');
    });
    
    this.sanitizer.addRule(/\ ?[[\d ,]+ ?\]/gmi, function (tag) {
      //Sanitize path array
      return tag.replaceAll(' ', '');
    });
    
    this.pathParser = new Parser();
    
  
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
    
    this.pathParser.addRule(/(\/[\w\d]+)/gmi, function (tag) {
      return { type: 'simple', text: tag};
    })
    
    this.OSCRegex = RegExp('(\/[^ ]+) *(.*)?','gm');
    
    this.argParser = new Parser();
    
    this.argParser.addRule(/[\"\']([^\"\']+)[\"\']/gmi, function(full, string) {
      return { type: 's', value : string };
    });
    
    this.argParser.addRule(/[^\w]+([TF]) +/gm, function(full, string) {
      let value = (string == 'T');
      return {type: string, value: value};
    });
    
    this.argParser.addRule(/(\d+[ ,.]+\d+) +/gm, function(value, float) {
      return {type: 'f', value: float}
    });
    
    this.argParser.addRule(/(\d+) /gm, function(value, number) {
      return {type: 'i', value: number}
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
     }
     
     return mother;
  }
  
  
  /**
    * Translates a line into a OSC.js object
  */
  translate(line) {
    line = this.sanitize(line);
     
    //let groups = line.match('/(\/[^ ]+) *(.*)?/gm');
    let groups = this.OSCRegex.exec(line);
    
    if (groups === undefined || groups == null)
      throw `Invalid OSC path '${line}'`;
    
    //Reset lastResult
    this.lastResult = { raw: line , path: groups[0]}
     
    this.lastResult.nodes = this.pathParser.toTree(groups[0]);
    
    if (this.lastResult.nodes.length > 1) {
      this.lastResult.tree = {root : true, children: []}; //root object
      //this.lastResult.currentNode = this.lastResult.tree;
      
      this.lastResult.tree = this.createTree(this.lastResult.tree, 0)
    }
    
    //translate arguments
    if (groups[2] !== undefined) {
      this.lastResult.args = this.argParser.toTree(groups[2]);
    }
    
    //build addresses
    this.lastResult.result = 
      this.render(undefined, this.lastResult.tree, [])
  }
  
  render(prefix, node, result) {
    let currentPrefix = (node.root !== undefined) ? '' : prefix+node.value;
    
    if (node.children !== undefined) {
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
}

/*
let parser = new OSCParser();
let teststring = '/test/part[0,15]/efx[1-2]/gain "/oh-oh" T 20 3.4 ';


try {
  parser.translate(teststring);  
} catch (err) {
  console.log(err);
} finally {
  console.log(parser.lastResult.tree);
  console.log(parser.lastResult.args);
  console.log(parser.lastResult.result);
}
*/
