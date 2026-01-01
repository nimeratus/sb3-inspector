// these are here to prevent the scripts taken from scratch-blocks from crashing
// while we extract block shape info
var goog={provide(){}, require(){}};
var Blockly={
Msg:{__proto__:null},
ScratchMsgs:{locales:{__proto__:null}},
/** @type {Object<string, {init?: ()=>unknown}?>} */
Blocks:{__proto__:null},
Categories: {},
mainWorkspace:{options:{}},
Constants:{Data:{}},
Extensions:{registerMixin(){}},
Colours:{event:{},looks:{},motion:{},sounds:{}}
};