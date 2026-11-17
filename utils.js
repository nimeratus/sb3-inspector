/** @type {(thing: unknown)=>thing is Object<string, unknown>} */
function isObject(thing) {
    return typeof(thing)==="object" && thing!==null;
}