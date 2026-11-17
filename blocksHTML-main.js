/** @type {HTMLInputElement} */ //@ts-ignore
var fi=document.getElementById("fi");
/** @type {HTMLSelectElement} */ //@ts-ignore
var sps=document.getElementById("sps");
/** @type {HTMLDivElement} */ //@ts-ignore
var normalBlocksDiv=document.getElementById("blocks-normal");
/** @type {HTMLDivElement} */ //@ts-ignore
var ghostBlocksDiv=document.getElementById("blocks-ghost");
/** @type {unknown[]} */
var sprites=[];
/** @type {unknown} */
var stage=null;
/** @type {Object<string, Variable>} */
var variables;
fi.onchange=async function() {
    if(!fi.files || !fi.files[0]) return;
    try {
        normalBlocksDiv.innerHTML="";
        ghostBlocksDiv.innerHTML="";
        sprites = await getSpriteListFromFile(fi.files[0]);
        stage = sprites.find(x=>isObject(x) && x.isStage);
        createSpriteDropdown();
        showBlocksInSprite(sprites[sps.selectedIndex-1], stage);
    } catch(err) {
        console.error(err);
        alert(err);
    }
}
sps.onchange=function() {
    try {
        showBlocksInSprite(sprites[sps.selectedIndex-1], stage);
    } catch(err) {
        console.error(err);
        alert(err);
    }
}
/** @param {Blob} file */
async function getSpriteListFromFile(file) {
    let sprites = [], spriteOrProject = null;
    if((await file.slice(0,1).text()) == "{") {
        spriteOrProject = JSON.parse(await file.text());
    }
    else {
        let zip=new Zip(file);
        await zip.loadMetadata();
        spriteOrProject=JSON.parse(new TextDecoder().decode(await zip.getFileContentAsync(zip.hasFile("project.json")?"project.json":"sprite.json")));
    }
    if(Array.isArray(spriteOrProject.targets)) sprites = spriteOrProject.targets;
    else sprites = [spriteOrProject];
    return sprites;
}
/** 
 * @param {unknown} sprite
 * @param {unknown} stage
 */
function showBlocksInSprite(sprite, stage) {
    normalBlocksDiv.innerHTML="";
    ghostBlocksDiv.innerHTML="";
    if(!isObject(sprite) || !isObject(sprite.blocks)) return;
    variables = getDeclaredVariablesForSpriteAndStage(sprite, stage);
    getFieldColor = function(array) {
        let id = array[2];
        if(typeof(id) !== "string") return null;
        if(id in variables) {
            switch(variables[id].type) {
                case "variable": return "variables-block";
                case "list": return "list-block";
                case "broadcast": return "broadcast-block";
            }
        }
        return null;
    };
    let spriteBlockSet = new Set();
    let topLevels = Object.entries(sprite.blocks).filter(x=>isObject(x[1]) && (x[1].topLevel || Array.isArray(x[1]) && x[1].length>3)).map(x=>x[0]);
    showBlocks(normalBlocksDiv, topLevels, null /* use the positions in the JSON */, sprite.blocks, spriteBlockSet);
    let ghostRoots = getGhostRoots(sprite.blocks);
    let positions = {__proto__: null};
    for(let i=0; i<ghostRoots.length; i++) positions[ghostRoots[i]] = {x: (i%17)*61, y: i*61};
    showBlocks(ghostBlocksDiv, ghostRoots, positions, sprite.blocks, spriteBlockSet);
}
function showBlocks(container, idsToShow, positions, blocks, spriteBlockSet) {
    let scale=0.675; // should be container's transform:scale()
    let minX=0, minY=0;
    for(let id of idsToShow) {
        let stackElem = createBlockStackFromJSON(id, blocks, spriteBlockSet);
        /** @type {Object<string, unknown>} */ // @ts-ignore the value is an object if the key included in the topLevels list
        let firstBlock = blocks[id];
        if(firstBlock.shadow) {
            stackElem.classList.add("shadowed-top-level");
        }

        let pos = {x: 0, y: 0};
        if(positions && positions[id]) {
            pos = positions[id];
        }
        else {
            if(Number.isFinite(firstBlock.x)) pos.x = +firstBlock.x;
            if(Number.isFinite(firstBlock.y)) pos.y = +firstBlock.y;
        }
        if(pos.x<minX) minX=pos.x;
        if(pos.y<minY) minY=pos.y;
        stackElem.style.left = pos.x + "px";
        stackElem.style.top = pos.y + "px";

        container.appendChild(stackElem);
        stackElem.tabIndex=0;
    }
    container.style.left=`${Math.ceil(-minX*scale)}px`;
    container.style.top=`${Math.ceil(-minY*scale)}px`;
}
function getGhostRoots(blocks) {
    let referenced = new Set();
    for(let id in blocks) {
        let block = blocks[id];
        referenced.add(block.next);
        if(block.inputs) {
            for(let name in block.inputs) {
                referenced.add(block.inputs[name][1]);
                referenced.add(block.inputs[name][2]);
            }
        }
    }
    return Object.keys(blocks).filter(id=>!referenced.has(id) && !(blocks[id] && blocks[id].topLevel));
}
function createSpriteDropdown() {
    sps.innerHTML = "";
    let option = document.createElement("option");
    option.innerText="-- select a sprite --";
    sps.appendChild(option);
    for(let i=0; i<sprites.length; i++) {
        let option = document.createElement("option");
        let sprite = sprites[i];
        let name = isObject(sprite) ? sprite.name : "";
        option.innerText=`(${i}) ${name}`;
        sps.appendChild(option);
    }
    sps.selectedIndex = 0;
}
/**
 * @param {unknown} sprite
 * @param {unknown} stage
 * @typedef {{id: string, type: string, name: string}} Variable
 * @returns {Object<string, Variable>}
 */
function getDeclaredVariablesForSpriteAndStage(sprite, stage) {
    /** @type {Object<string, Variable>} */ // @ts-expect-error __proto__ has special behaviour in JS
    let variables = {__proto__: null};
    if(isObject(stage) && isObject(stage.broadcasts)) {
        for(let varId in stage.broadcasts) {
            let varObject = stage.broadcasts[varId];
            if(!isObject(varObject)) continue;
            variables[varId]={id: varId, type: "broadcast", name: String(varObject[0])};
        }
    }
    if(isObject(stage) && isObject(stage.variables)) {
        for(let varId in stage.variables) {
            let varObject = stage.variables[varId];
            if(!isObject(varObject)) continue;
            variables[varId]={id: varId, type: "variable", name: String(varObject[0])};
        }
    }
    if(isObject(stage) && isObject(stage.lists)) {
        for(let varId in stage.lists) {
            let varObject = stage.lists[varId];
            if(!isObject(varObject)) continue;
            variables[varId]={id: varId, type: "list", name: String(varObject[0])};
        }
    }
    if(isObject(sprite) && isObject(sprite.broadcasts)) {
        for(let varId in sprite.broadcasts) {
            let varObject = sprite.broadcasts[varId];
            if(!isObject(varObject)) continue;
            variables[varId]={id: varId, type: "broadcast", name: String(varObject[0])};
        }
    }
    if(isObject(sprite) && isObject(sprite.variables)) {
        for(let varId in sprite.variables) {
            let varObject = sprite.variables[varId];
            if(!isObject(varObject)) continue;
            variables[varId]={id: varId, type: "variable", name: String(varObject[0])};
        }
    }
    if(isObject(sprite) && isObject(sprite.lists)) {
        for(let varId in sprite.lists) {
            let varObject = sprite.lists[varId];
            if(!isObject(varObject)) continue;
            variables[varId]={id: varId, type: "list", name: String(varObject[0])};
        }
    }
    return variables;
}