/**
 * @typedef {{class: string, breaksCRow?: boolean}} BlockInputType
 * @typedef {{type: "label", text: string} |
 *      {type: "input", inputName: string|null, inputType: BlockInputType} |
 *      {type: "id", id: string}
 * } BlockComponent
 * @typedef {{text: BlockComponent[], shape: string, configurable?: boolean}} BlockInfo
 */

/** @type {Object<string, BlockInputType>} */
let inputTypes = {
    "o": {class: "block-input"},
    "b": {class: "block-input block-boolean-input"},
    "C": {class: "C-block-input", breaksCRow: true},
    "t": {class: "block-input block-field-container block-field-text"},
    "f": {class: "block-input block-field-container"}
};

/** @type {Object<string, BlockInfo>} */
let blockInfo = {
    // @ts-expect-error __proto__ has special behaviour in JS
    __proto__: null,
    motion_turnright: {text: b("turn right %o{DEGREES} degrees"), shape: "stack-block", configurable: false},
    motion_turnleft: {text: b("turn left %o{DEGREES} degrees"), shape: "stack-block", configurable: false},
    event_whenflagclicked: {text: b("when FLAG clicked"), shape: "hat-block", configurable: false},
    control_if: {text: b("if %b{CONDITION} then %C{SUBSTACK}"), shape: "C-block"},
    control_if_else: {text: b("if %b{CONDITION} then %C{SUBSTACK} else %C{SUBSTACK2}"), shape: "C-block"},
    control_repeat: {text: b("repeat %o{TIMES}%C{SUBSTACK}"), shape: "C-block"},
    control_repeat_until: {text: b("repeat until %b{CONDITION}%C{SUBSTACK}"), shape: "C-block"},
    control_stop: {text: b("stop %f{STOP_OPTION}"), shape: "cap-block"},
    control_create_clone_of: {text: b("create clone of %o{CLONE_OPTION}"), shape: "stack-block"},
    argument_reporter_string_number: {text: b("%t{VALUE}"), shape: "reporter-block", configurable: false},
    argument_reporter_boolean: {text: b("%t{VALUE}"), shape: "boolean-block", configurable: false},
    data_variable: {text: b("%t{VALUE}"), shape: "reporter-block", configurable: false},
    data_listcontents: {text: b("%t{VALUE}"), shape: "reporter-block", configurable: false},
    note: {text: b("%t{NOTE}"), shape: "reporter-block", configurable: false},
    operator_add: {text: b("%o{NUM1} + %o{NUM2}"), shape: "reporter-block"},
    operator_subtract: {text: b("%o{NUM1} - %o{NUM2}"), shape: "reporter-block"},
    operator_multiply: {text: b("%o{NUM1} * %o{NUM2}"), shape: "reporter-block"},
    operator_divide: {text: b("%o{NUM1} / %o{NUM2}"), shape: "reporter-block"},
    operator_mod: {text: b("%o{NUM1} mod %o{NUM2}"), shape: "reporter-block"},
    operator_equals: {text: b("%o{OPERAND1} = %o{OPERAND2}"), shape: "boolean-block"},
    operator_lt: {text: b("%o{OPERAND1} < %o{OPERAND2}"), shape: "boolean-block"},
    operator_gt: {text: b("%o{OPERAND1} > %o{OPERAND2}"), shape: "boolean-block"},
    operator_and: {text: b("%b{OPERAND1} and %b{OPERAND2}"), shape: "boolean-block"},
    operator_or: {text: b("%b{OPERAND1} or %b{OPERAND2}"), shape: "boolean-block"},
    operator_not: {text: b("not %b{OPERAND}"), shape: "boolean-block"},
    operator_round: {text: b("round %o{NUM}"), shape: "reporter-block"},
    operator_mathop: {text: b("%f{OPERATOR} of %o{NUM}"), shape: "reporter-block"},
    procedures_definition: {text: b("define %o{custom_block}"), shape: "define-block"},
};
let menuBlockInfo = {
    motion_goto_menu: "TO",
    motion_glideto_menu: "TO",
    motion_pointtowards_menu: "TOWARDS",
    looks_costume: "COSTUME",
    looks_backdrops: "BACKDROP",
    sound_sounds_menu: "SOUND_MENU",
    sensing_touchingobjectmenu: "TOUCHINGOBJECTMENU",
    sensing_distancetomenu: "DISTANCETOMENU",
    sensing_keyoptions: "KEY_OPTION",
    sensing_of_object_menu: "OBJECT",
    control_create_clone_of_menu: "CLONE_OPTION",
    pen_menu_colorParam: "colorParam"
};
for(let [opcode, field] of Object.entries(menuBlockInfo)) {
    blockInfo[opcode] = {text: b("%o{"+field+"}"), shape: "reporter-block"};
}
/**
 * parses block text for blockInfo object
 * @param {string} blockText
 * @returns {BlockComponent[]}
 */
function b(blockText) {
    let label = "";
    /** @type {BlockComponent[]} */
    let result = [];
    for(let i=0; i<blockText.length; i++) {
        if(blockText[i]!=="%") {
            label+=blockText[i];
        }
        else if(blockText[i+1]==="%") {
            label+="%"; i+=1;
        }
        else {
            if(label.length>0) result.push({text: label, type: "label"});
            label = "";
            i+=1;
            /** @type {BlockInputType} */
            let inputType;
            if(blockText[i] in inputTypes) inputType = inputTypes[blockText[i]];
            else throw new Error(`Unknown input type ${blockText[i]} in "${blockText}"`);
            let inputName = null;
            if(blockText[i+1] === "{") {
                i+=2;
                inputName = "";
                while(i<blockText.length && blockText[i] !== "}") {
                    if(blockText[i]==="\\") {
                        i+=1;
                    }
                    inputName += blockText[i];
                    i+=1;
                }
                if(blockText[i] !== "}") throw new Error(`Unexpected end of input, expected } in "${blockText}"`);
            }
            result.push({type: "input", inputName, inputType});
        }
    }
    if(label.length>0) result.push({text: label, type: "label"});
    return result;
}