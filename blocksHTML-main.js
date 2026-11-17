/** @type {HTMLInputElement} */ //@ts-ignore
var fi=document.getElementById("fi");
/** @type {HTMLSelectElement} */ //@ts-ignore
var sps=document.getElementById("sps");
/** @type {HTMLTextAreaElement} */ //@ts-ignore
var jsontxt=document.getElementById("jsontxt");
/** @type {HTMLDetailsElement} */ //@ts-ignore
var jsonhider=document.getElementById("jsonhider");
/** @type {HTMLDivElement} */ //@ts-ignore
var normalBlocksDiv=document.getElementById("blocks-normal");
/** @type {HTMLDivElement} */ //@ts-ignore
var ghostBlocksDiv=document.getElementById("blocks-ghost");
/** @type {unknown[]} */
var sprites=[];
/** @type {string} */
var displayedJSON;
/** @type {unknown} */
var stage=null;
/** @type {Object<string, Variable>} */
var variables;
/** @param {string} text */
function setDisplayedJSON(text) {
    displayedJSON=text;
    if(jsonhider.open) jsontxt.value=text;
}
fi.onchange=async function() {
    if(!fi.files || !fi.files[0]) return;
    try {
        normalBlocksDiv.innerHTML="";
        ghostBlocksDiv.innerHTML="";
        let jsonText=await getProjectJSONTextFromFile(fi.files[0]);
        setDisplayedJSON(jsonText);
        sprites = getSpriteListFromJSONText(jsonText);
        stage = sprites.find(x=>isObject(x) && x.isStage);
        createSpriteDropdown();
        sps.selectedIndex = 0;
        showBlocksInSprite(sprites[sps.selectedIndex-1], stage);
    } catch(err) {
        console.error(err);
        alert(err);
    }
}
jsontxt.onchange=function() {
    if(jsontxt.value.length==0) return;
    try {
        setDisplayedJSON(jsontxt.value);
        let sel=sps.selectedIndex;
        sprites = getSpriteListFromJSONText(jsontxt.value);
        stage = sprites.find(x=>isObject(x) && x.isStage);
        createSpriteDropdown();
        sps.selectedIndex = sel;
        showBlocksInSprite(sprites[sps.selectedIndex-1], stage);
    }
    catch(err) {
        console.error(err);
        alert(err);
    }
}
jsonhider.ontoggle=function() {
    setDisplayedJSON(displayedJSON);
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
async function getProjectJSONTextFromFile(file) {
    if((await file.slice(0,1).text()) == "{") {
        return await file.text();
    }
    else {
        let zip=new Zip(file);
        await zip.loadMetadata();
        let fileName=zip.hasFile("project.json")?"project.json":"sprite.json";
        let fileContent=await zip.getFileContentAsync(fileName);
        return new TextDecoder().decode(fileContent);
    }
}
/** @param {string} text */
function getSpriteListFromJSONText(text){
    let sprites = [], spriteOrProject = JSON.parse(text);
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
    let topLevels = Object.entries(sprite.blocks).filter(x=>isTopLevelBlock(x[1])).map(x=>x[0]);
    showBlocks(normalBlocksDiv, topLevels, null /* use the positions in the JSON */, sprite.blocks, spriteBlockSet);
    let ghostRoots = [...getRoots(sprite.blocks)].filter(x=>!spriteBlockSet.has(x));
    /** @type {Record<string, {x:number,y:number}?>} */
    let positions = {__proto__: null};
    for(let i=0; i<ghostRoots.length; i++) positions[ghostRoots[i]] = {x: (i%17)*61, y: i*61};
    showBlocks(ghostBlocksDiv, ghostRoots, positions, sprite.blocks, spriteBlockSet);
}
/**
 * @param {unknown} block 
 */
function isTopLevelBlock(block) {
    if(!isObject(block)) return false;
    if(block.topLevel) return true;
    if(Array.isArray(block) && block.length>3) return true;
    return false;
}
/**
 * @param {HTMLElement} container
 * @param {string[]} idsToShow
 * @param {Object<string,unknown>} blocks
 * @param {Record<string,{x:number,y:number}?>?} positions
 * @param {Set<string>} spriteBlockSet
 */
function showBlocks(container, idsToShow, positions, blocks, spriteBlockSet) {
    let scale=0.675; // should be container's transform:scale()
    let minX=0, minY=0;
    for(let id of idsToShow) {
        /** @type {Object<string, unknown>} */
        let firstBlock;
        if(isObject(blocks[id])) {
            firstBlock = blocks[id];
        } else {
            console.error("showBlocks(): the idsToShow should only index valid blocks");
            firstBlock = {};
        }

        let stackElem = createBlockStackFromJSON(id, blocks, spriteBlockSet);
        if(firstBlock.shadow) {
            stackElem.classList.add("shadowed-top-level");
        }

        let pos = {x: 0, y: 0};
        if(positions && positions[id]) {
            pos = positions[id];
        }
        else {
            if(Number.isFinite(firstBlock.x)) pos.x = Number(firstBlock.x);
            if(Number.isFinite(firstBlock.y)) pos.y = Number(firstBlock.y);
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
/** 
 * @param {Object<string,unknown>} blocks
 */
function getRoots(blocks) {
    /** @type {Record<string,string>} */
    let blocks_to_roots = Object.create(null);
    function getRootOf(/** @type {string} */ id) {
        /** @type {string} */
        let root = id;
        while((root in blocks_to_roots) && blocks_to_roots[root]!==root) {
            root = blocks_to_roots[root];
        }
        blocks_to_roots[id]=root;
        return root;
    }
    for(let id in blocks) {
        let root = getRootOf(id);
        let block = blocks[id];
        for(let refId of descendantBlockIDs(block)) {
            blocks_to_roots[refId]=root;
        }
    }
    /** @type {Set<string>} */
    let roots = new Set();
    for(let id in blocks_to_roots) {
        roots.add(getRootOf(id));
    }
    return roots;
}
/**
 * @param {unknown} block
 */
function* descendantBlockIDs(block) {
    if(!isObject(block) || Array.isArray(block)) return;
    if(typeof(block.next)==="string") yield block.next;
    if(isObject(block.inputs)) {
        for(let name in block.inputs) {
            let inputArr = block.inputs[name];
            if(isObject(inputArr)) {
                if(typeof inputArr[1] === "string") yield inputArr[1];
                if(typeof inputArr[2] === "string") yield inputArr[2];
            }
        }
    }
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
}
/**
 * @param {unknown} sprite
 * @param {unknown} stage
 * @typedef {{id: string, type: string, name: string}} Variable
 * @returns {Object<string, Variable>}
 */
function getDeclaredVariablesForSpriteAndStage(sprite, stage) {
    /** @type {Object<string, Variable>} */
    let variables = Object.create(null);
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