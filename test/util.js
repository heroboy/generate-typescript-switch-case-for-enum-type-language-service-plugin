"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
function loadSource(fileName) {
    let sourceCode = fs.readFileSync(fileName, { encoding: 'utf8' });
    let lookPositions = [];
    //  /*a*/
    const re_lookPos = /\/\*([a-zA-Z0-9])\*\//;
    while (true) {
        let m = re_lookPos.exec(sourceCode);
        if (!m)
            break;
        lookPositions.push({
            name: m[1],
            pos: m.index
        });
        sourceCode = sourceCode.slice(0, m.index) + sourceCode.slice(m.index + m[0].length);
    }
    //
    const re_result = /^\s*\/\/\s*([a-zA-Z0-9])\s*=>\s*\[([^\]]*)\]/gm;
    let mm;
    let mapping = {};
    do {
        mm = re_result.exec(sourceCode);
        if (mm) {
            mapping[mm[1]] = {
                items: mm[2].split(',').map(s => s.trim())
            };
        }
    } while (mm);
    return {
        fileName,
        sourceCode,
        lookPositions,
        mapping
    };
}
exports.loadSource = loadSource;
// extract code like case XXX.YYY:" return ["XXX.YYY"]
function extractAllCaseItems(code) {
    let ret = [];
    let re = /\s+case\s+([\w\."'`]*):/g;
    let m;
    do {
        m = re.exec(code);
        if (m) {
            ret.push(m[1]);
        }
    } while (m);
    return ret;
}
exports.extractAllCaseItems = extractAllCaseItems;
function hasRefactorInfo(info) {
    if (info) {
        for (let ref of info) {
            if (ref.name === 'generate-switch-case')
                return true;
        }
    }
    return false;
}
exports.hasRefactorInfo = hasRefactorInfo;
function arrayEqual(arr1, arr2) {
    if (arr1.length !== arr2.length)
        return false;
    arr1 = arr1.slice();
    arr2 = arr2.slice();
    arr1.sort();
    arr2.sort();
    for (let i = 0; i < arr1.length; ++i) {
        if (arr1[i] !== arr2[i])
            return false;
    }
    return true;
}
exports.arrayEqual = arrayEqual;
