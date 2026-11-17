// these are to prevent crashes caused by rendering extremely long text
let MAX_INPUT_TEXT_LENGTH_TRESHOLD = 1024;
let MAX_BLOCK_TEXT_LENGTH_TRESHOLD = 1024;

/** @param {unknown} inputName  */
function isSubstackInputName(inputName) {
    return typeof(inputName)==="string" && inputName.startsWith("SUBSTACK");
}
var blockextensionregexp = /^([a-zA-Z0-9]*)/;
var extensions=["music","pen","videoSensing","faceSensing","text2speech","translate","makeymakey","microbit","gdxfor","ev3","boost","wedo2"];
/** @param {string} opcode */
function getClassForOpcode(opcode) {
    if(opcode === "procedures_prototype") return "procedures_prototype-block";
    if(opcode === "note") return "input-block";
    // @ts-expect-error this won't be null because the regexp matches empty string in worst case
    let type = opcode.match(blockextensionregexp)[1];
    if(type === "data" && opcode.includes("variable")) return "variables-block";
    if(type === "data" && opcode.includes("list")) return "list-block";
    if(extensions.includes(type)) type="extension";
    return type+"-block";
}
/**
 * @param {Object<string, unknown>} blockJSON
 * @returns {BlockInfo}
 */
function getBlockShapeInfo(blockJSON) {
    let opcode=String(blockJSON.opcode);
    // this block is special because the shape depends on the selected field option
    if(opcode==="control_stop"&&isObject(blockJSON.fields)&&Array.isArray(blockJSON.fields.STOP_OPTION)&&blockJSON.fields.STOP_OPTION[0]==="other scripts in sprite") {
        return {text: blockInfo.control_stop.text, shape: "stack-block"};
    }
    // this block is special because the shape is described by the project JSON
    if((opcode === "procedures_call" || opcode === "procedures_prototype") && isObject(blockJSON.mutation) && typeof(blockJSON.mutation.proccode)==="string") {
        /** @type {BlockComponent[]} */
        let arr=[];
        /** @type {unknown[]} */
        let inputIDs=[];
        try {
            if(typeof(blockJSON.mutation.argumentids)==="string") {
                inputIDs=JSON.parse(blockJSON.mutation.argumentids);
            }
        } catch {
            // Don't add the inputs, createBlockFromJSON() will append
            // them to the end of the block
        }
        let label="";
        let j=0;
        let blockText = blockJSON.mutation.proccode;
        for(let i=0; i<blockText.length; i++) {
            if(blockText[i]!=="%" || blockText[i+1]!=="s"&&blockText[i+1]!=="n"&&blockText[i+1]!=="b" && j<inputIDs.length) {
                label+=blockText[i];
            }
            else {
                if(label.trim().length>0) arr.push({text: label, type: "label"});
                label="";
                let inputName = String(inputIDs[j++]);
                arr.push({type: "id", id: inputName});
                arr.push({type: "input", inputName, inputType: blockText[i+1]==="b"?inputTypes.b:inputTypes.o})
                i+=1;
            }
        }
        if(label.trim().length>0) arr.push({text: label, type: "label"});
        return {text: arr, shape: "stack-block"};
    }
    // for normal blocks get the shape from the dictionary
    if(opcode in blockInfo) return blockInfo[opcode];
    // for blocks with unknown opcode fall back to just listing the JSON components (opcode, fields, inputs)
    /** @type {BlockComponent[]} */
    let arr=[{text: opcode, type: "label"}];
    let shape="block";
    for(let fieldName of (isObject(blockJSON.fields) ? Object.keys(blockJSON.fields) : [])) {
        arr.push({type: "label", text: fieldName});
        arr.push({type: "input", inputName: fieldName, inputType: inputTypes.o});
    }
    for(let inputName of (isObject(blockJSON.inputs) ? Object.keys(blockJSON.inputs) : [])) {
        arr.push({type: "label", text: inputName});
        if(isSubstackInputName(inputName)) {
            arr.push({type: "input", inputName: inputName, inputType: inputTypes.C});
            shape="C-block";
        } else {
            arr.push({type: "input", inputName: inputName, inputType: inputTypes.o});
        }
    }
    return {text: arr, shape: shape};
}
/** @param {unknown} blockJSON */
function createBlockFromJSON(blockJSON) {
    /** @type {Object<string, HTMLElement>} */
    // @ts-expect-error __proto__ has special behaviour in JS
    let input2DOM = {__proto__: null};
    if(Array.isArray(blockJSON)) return {element: createLiteralInput(blockJSON), input2DOM: null};
    let result = document.createElement("div");
    result.classList.add("block");
    if(!isObject(blockJSON)) {
        result.innerText = String(blockJSON);
        result.className = "invalid-block";
        return {element: result, input2DOM};
    }
    let inputs = isObject(blockJSON.inputs) ? Object.keys(blockJSON.inputs) : [];
    let fields = isObject(blockJSON.fields) ? Object.keys(blockJSON.fields) : [];
    let {text, shape} = getBlockShapeInfo(blockJSON);
    if(inputs.some(isSubstackInputName)) shape="C-block";
    result.classList.add(shape);
    if(typeof(blockJSON.opcode)==="string") result.classList.add(getClassForOpcode(blockJSON.opcode));
    let blockRow = result;
    if(shape === "C-block") {
        blockRow = document.createElement("div");
        blockRow.className="C-block-row";
        result.appendChild(blockRow);
    }
    /**
     * @param {string} inputName
     * @param {string} [inputClass]
     * @param {boolean|undefined} [breakCRow]
     */
    function addInput(inputName, inputClass, breakCRow) {
        if(inputName in input2DOM) return {input: input2DOM[inputName], isNew: false, createdCRow: false};
        if(typeof(breakCRow)==="undefined") breakCRow=isSubstackInputName(inputName);
        if(typeof(inputClass)==="undefined") inputClass=breakCRow?"C-block-input":"block-input";
        let inputPlaceholder = document.createElement("span");
        inputPlaceholder.className = inputClass;
        if(breakCRow) {
            result.appendChild(inputPlaceholder);
            blockRow = document.createElement("div");
            blockRow.className="C-block-row";
            result.appendChild(blockRow);
        }
        else {
            blockRow.appendChild(inputPlaceholder);
        }
        inputPlaceholder.setAttribute("data-inputname", inputName);
        input2DOM[inputName] = inputPlaceholder;
        return {input: inputPlaceholder, isNew: true, createdCRow: breakCRow};
    }
    for(let blockThingy of text) {
        if(blockThingy.type === "label") {
            let label = document.createElement("span");
            label.innerText = limitTextLength(blockThingy.text, MAX_BLOCK_TEXT_LENGTH_TRESHOLD);
            blockRow.appendChild(label);
        }
        else if(blockThingy.type === "input" && typeof(blockThingy.inputName)==="string") {
            addInput(blockThingy.inputName, blockThingy.inputType.class, blockThingy.inputType.breaksCRow);
        }
        else if(blockThingy.type === "id") {
            blockRow.appendChild(createIdHash(blockThingy.id));
        }
    }
    let additionalInputShower = document.createElement("input");
    additionalInputShower.type="checkbox";
    additionalInputShower.classList.add("block-additional-input-shower");
    blockRow.appendChild(additionalInputShower);
    let hasAdditionalInputs = false;
    // This check is here for TypeScript only, if the thing isn't an object
    // then the for loop loops over an empty array
    if(isObject(blockJSON.inputs))
    for(let inputName of inputs) {
        let prevBlockRow = blockRow;
        let {input, isNew, createdCRow} = addInput(inputName);
        if(isNew) {
            hasAdditionalInputs = true;
            let label = createIdHash(inputName);
            if(!createdCRow) blockRow.insertBefore(label, input);
            else prevBlockRow.appendChild(label);
        }
        if(Array.isArray(blockJSON.inputs[inputName])) {
            let inputBlock = createBlockReference(blockJSON.inputs[inputName][1]);
            inputBlock.classList.add("shadow-block");
            input.appendChild(inputBlock);
        }
    }
    if(isObject(blockJSON.fields))
    for(let fieldName of fields) {
        let prevBlockRow = blockRow;
        let {input, isNew, createdCRow} = addInput(fieldName);
        if(isNew) {
            hasAdditionalInputs = true;
            let label = createIdHash(fieldName);
            if(!createdCRow) blockRow.insertBefore(label, input);
            else prevBlockRow.appendChild(label);
        }
        if(Array.isArray(blockJSON.fields[fieldName])) {
            let field=blockJSON.fields[fieldName];
            let inputBlock = createField(field, fieldName);
            input.appendChild(inputBlock);
        }
    }
    if(!hasAdditionalInputs) additionalInputShower.remove();
    return {element: result, input2DOM};
}
/** 
 * @param {unknown[]} field
 * @param {string} fieldName
 */
function createField(field, fieldName) {
    let fieldElem = document.createElement("span");
    fieldElem.className="block-field";
    fieldElem.innerText=limitTextLength(String(field[0]), MAX_INPUT_TEXT_LENGTH_TRESHOLD);
    let fieldClassName = getFieldColor([fieldName, ...field]);
    if(fieldClassName) fieldElem.classList.add(fieldClassName);
    if(typeof(field[1])==="string" && shouldAddIdHash([fieldName, ...field])) fieldElem.appendChild(createIdHash(field[1]));
    return fieldElem;
}
/** @param {unknown} blockId */
function createBlockReference(blockId, options) {
    var a=document.createElement("a");
    a.innerText=limitTextLength("\u2192\u00a0"+String(blockId), MAX_BLOCK_TEXT_LENGTH_TRESHOLD);
    a.setAttribute("data-id", blockId);
    a.classList.add("block-reference");
    if(typeof(blockId) === "string") a.href="#block-"+blockId;
    var span=document.createElement("span");
    span.classList.add("block");
    span.classList.add("replacement-block");
    span.appendChild(a);
    if(options && options.missingBlock) {
        a.removeAttribute("href");
        span.classList.add("invalid-block-reference");
        a.title = "couldn't find block with this ID";
    }
    return span;
}
/**
 * @param {unknown} blockId
 * @param {Object<string, unknown>} blocks
 * @param {Set<any>} [blockSet=new Set()]
 */
function createBlockStackFromJSON(blockId, blocks, blockSet = new Set()) {
    /** @type {HTMLElement & {_block_pos_x?: number, _block_pos_y?: number}} */
    let stackElem = document.createElement("div");
    stackElem.classList.add("block-stack");
    let firstBlock = typeof(blockId)==="string" ? blocks[blockId] : null;
    if(isObject(firstBlock)) {
        let x=Number(firstBlock.x)||Number(firstBlock[3])||0;
        let y=Number(firstBlock.y)||Number(firstBlock[4])||0;
        stackElem.style.left = x+"px";
        stackElem.style.top = y+"px";
        stackElem._block_pos_x = x;
        stackElem._block_pos_y = y;
    }
    let block;
    /** @type {unknown} */
    let nextBlockId=blockId;
    while(typeof(nextBlockId)==="string" && (block = blocks[nextBlockId], isObject(block))) {
        if(blockSet.has(nextBlockId)) {
            stackElem.appendChild(createBlockReference(nextBlockId));
            return stackElem;
        }
        blockSet.add(nextBlockId);
        let {element: blockElem, input2DOM} = createBlockFromJSON(block);
        blockElem.id = "block-"+nextBlockId;
        stackElem.appendChild(blockElem);
        try {
            fillBlockInputs(block, input2DOM, blocks, blockSet);
        } catch(err) {
            console.error(err);
        }
        nextBlockId = block.next;
    }
    if(nextBlockId) {
        if(Array.isArray(nextBlockId) && ("1" in nextBlockId)) stackElem.appendChild(createLiteralInput(nextBlockId));
        else {
            stackElem.appendChild(createBlockReference(nextBlockId, {missingBlock: true}));
        }
    }
    return stackElem;
}
/**
 * @param {Object<string, unknown>} blockJSON
 * @param {Object<string, HTMLElement>} input2DOM
 * @param {Object<string, unknown>} blocks
 */
function fillBlockInputs(blockJSON, input2DOM, blocks, blockSet = new Set()) {
    let inputs = isObject(blockJSON.inputs) ? blockJSON.inputs : {};
    let fields = isObject(blockJSON.fields) ? blockJSON.fields : {};
    let names = new Set([...Object.keys(inputs), ...Object.keys(fields)]);
    for(let name of names) {
        if(!(name in input2DOM)) {
            console.error("Can't find input placeholder");
            continue;
        }
        input2DOM[name].innerHTML = "";
        let inputArr = inputs[name];
        let input = isObject(inputArr) ? (inputArr[1] ?? inputArr[2]) : null;
        if(isObject(inputArr) && input !== null && input !== undefined) {
            let stackElem = createBlockStackFromJSON(input, blocks, blockSet);
            while(stackElem.firstChild) {
                let block = stackElem.firstChild;
                if((block instanceof Element) && !block.classList.contains("block-reference")) {
                    if(inputArr[0]==1 || inputArr[1] === null || inputArr[1] === undefined) {
                        block.classList.add("shadow-block");
                        block.classList.remove("block");
                    }
                    else {
                        block.classList.remove("shadow-block");
                        block.classList.add("block");
                    }
                }
                input2DOM[name].appendChild(block);
            }
        }
        if(Array.isArray(fields[name])) {
            input2DOM[name].appendChild(createField(fields[name], name));
        }
    }
}
/** @param {unknown[]} array */
let shouldAddIdHash = function(array) {
    return true;
}
/** 
 * @param {unknown[]} array
 * @returns {string|null}
 */
let getFieldColor = function(array) {
    return null;
}
/**
 * @param {unknown[]} array
 */
function createLiteralInput(array) {
    let blockElem=document.createElement("span");
    let inputElem=document.createElement("span");
    let fieldElem=document.createElement("span");
    blockElem.appendChild(inputElem);
    inputElem.appendChild(fieldElem);
    let value = String(array[1]);
    fieldElem.innerText=limitTextLength(value,MAX_INPUT_TEXT_LENGTH_TRESHOLD);
    blockElem.classList.add("block");
    blockElem.classList.add("reporter-block");
    inputElem.classList.add("block-input");
    inputElem.classList.add("block-field-text");
    fieldElem.classList.add("block-field");
    switch(array[0]) {
        case 11: blockElem.classList.add("event-block"); inputElem.classList.remove("block-field-text"); break;
        case 12: blockElem.classList.add("variables-block"); break;
        case 13: blockElem.classList.add("list-block"); break;
        default: blockElem.classList.add("input-block"); break;
    }
    if(array[0]===9) {
        if(isHexColor(value)) {
            blockElem.style.backgroundColor=value;
            blockElem.style.color=isLightColor(value)?"#000000":"#ffffff";
        } else {
            fieldElem.style.color="darkred";
        }
    }
    if(typeof(array[2])==="string") {
        if(shouldAddIdHash(array)) fieldElem.appendChild(createIdHash(array[2]));
    }
    let fieldClassName = getFieldColor(array);
    if(fieldClassName) fieldElem.classList.add(fieldClassName);
    return blockElem;
}
/** @type {(R:number,G:number,B:number)=>string} */
function rgb2hex(R,G,B) {
    return "#"+R.toString(16).padStart(2,"0")+G.toString(16).padStart(2,"0")+B.toString(16).padStart(2,"0");
}
var hashCharacters = "0123456789bcdfghjklmnpqrstvwxyzBCDFGHJLMNQRTY";
/** @type {(a:bigint,b:bigint)=>bigint} */
function mod(a, b) {
    return (a%b+b)%b;
}
/** @param {string} id */
function createIdHash(id) {
    let hash = 0n;
    for(let i=0; i<id.length; i++) {
        hash = (hash*100_019n + BigInt(id.charCodeAt(i))*10_007n) % 1_000_000_009n;
    }
    let R=Number((hash>>16n)&0xFFn), G=Number((hash>>8n)&0xFFn), B=Number(hash&0xFFn);
    let color=rgb2hex(R,G,B);
    if(isLightColor(color)) {
        color=rgb2hex(255-R,255-G,255-B);
    }
    let span=document.createElement("span");
    span.style.backgroundColor=color;
    span.classList.add("id-hash");
    let N=BigInt(hashCharacters.length);
    let a=mod(hash,N);
    let b=mod((hash-a)/N,N)
    span.innerText=hashCharacters[Number(a)]+hashCharacters[Number(b)];
    span.setAttribute("data-id",id);
    return span;
}
var hexColorRegExp = /^#[0-9A-Fa-f]{6}$/;
/** @type {(str: string)=>boolean} */
function isHexColor(string) {
    return typeof(string)==="string" && hexColorRegExp.test(string);
}
/** @param {string} hexColor */
function isLightColor(hexColor) {
    if(!isHexColor(hexColor)) return false;
    let RGB = Number.parseInt(hexColor.slice(1),16);
    let R=((RGB>>16)&0xFF)/255;
    let G=((RGB>>8)&0xFF)/255;
    let B=((RGB)&0xFF)/255;
    return R**2*0.4+G**2*0.5+B**2*0.1>0.5;
}
/**
 * @param {string} text
 * @param {number} length
 */
function limitTextLength(text, length) {
    if(text.length>length) {
        let suffix = `… (${text.length} long)`;
        return text.slice(0,length-suffix.length)+suffix;
    }
    return text;

}

