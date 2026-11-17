// extracts block shape info using the scripts taken from scratch-blocks

var blocklyMessageAdapter = {
    /**
     * @param {string} opcode
     * @param {unknown} thing
     */
    jsonInit(opcode, thing) {
        if(!isObject(thing)) return;
        /** @type {BlockComponent[]} */
        let text=[], shape="stack-block";
        if(Array.isArray(thing.extensions)) {
            for(let x of thing.extensions) {
                if(x in this.shapes) shape=this.shapes[x];
            }
        }
        if("outputShape" in thing) shape="reporter-block";
        if("message1" in thing) shape="C-block";
        for(let i=0; ("message"+i) in thing; i++) {
            let msg = String(thing["message"+i]);
            let _args = thing["args"+i];
            let args=Array.isArray(_args)?_args:[];
            let label = "";
            for(let j=0; j<msg.length; j++) {
                if(msg[j]==="%" && +msg[j+1]>0) {
                    if(label.trim().length>0) text.push({type:"label",text:label});
                    label="";
                    j+=1;
                    let arg=args[+msg[j]-1];
                    if(!arg) continue;
                    if("name" in arg) text.push({
                        type: "input",
                        inputName: arg.name,
                        inputType: arg.type==="input_statement"?inputTypes.C:(
                            arg.check==="Boolean"?inputTypes.b:(
                                typeof(arg.type)==="string"&&arg.type.startsWith("field_")?inputTypes.f:inputTypes.o
                            )
                        )
                    });
                }
                else label+=msg[j];
            }
            if(label.trim().length>0) text.push({type:"label",text:label});
        }
        blockInfo[opcode]={text, shape};
    },
    /** @type {Object<string,string>} */
    shapes: {
        shape_end: "cap-block",
        shape_statement: "stack-block",
        shape_hat: "hat-block",
        output_string: "reporter-block",
        output_number: "reporter-block",
        output_boolean: "boolean-block"
    },
    /** @type {Object<string,BlockInputType>} */
    inputShapes: {
        "input_statement": inputTypes.C,
        "input_value": inputTypes.o
    }
};
for(let [opcode, blockInit] of Object.entries(Blockly.Blocks)) {
    try {
        if(blockInfo[opcode] && blockInfo[opcode].configurable === false) continue;
        if(!blockInit || !blockInit.init) continue;
        blockInit.init.call({
            jsonInit: blocklyMessageAdapter.jsonInit.bind(blocklyMessageAdapter, opcode)
        });
    } catch(err) {
        console.error(err);
    }
}