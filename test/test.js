"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript/lib/tsserverlibrary");
const util = require("./util");
const assert = require("assert");
const myplugin = require('../index');
const ts_morph_1 = require("ts-morph");
function TestWithFile(fileName) {
    //测试方法：
    //在测试的ts文件中，用/*a*/ 表示一个检测点。（一个字符，不能有空格）
    //在任意一行 //a=>[XX,YY] ，表示在这个插入点对应生成的case语句的内容。
    //然后下面的测试代码，就会解析ts文件中的上面两种内容，然后测试，看看生成的代码是不是符合。
    describe("Test file:" + fileName, function () {
        let project = new ts_morph_1.Project({ useInMemoryFileSystem: true });
        //这里直接修改了ts-morph的js代码，使得能获得host
        //几个null，没有用到就算了。我估计只有在language server中才会有这几个对象吧，所以也没办法获取到。
        let info = {
            project: null,
            languageService: project.getLanguageService().compilerObject,
            languageServiceHost: project.getLanguageService()['_languageServiceHost'],
            serverHost: null,
            config: {}
        };
        let ls = myplugin({ typescript: ts }).create(info);
        let sourceCodeInfo = util.loadSource(fileName);
        it('assert loadSource corrent', function () {
            for (let obj of sourceCodeInfo.lookPositions) {
                assert(sourceCodeInfo.mapping[obj.name], `pos '${obj.name}' must exists`);
            }
        });
        project.createSourceFile(sourceCodeInfo.fileName, sourceCodeInfo.sourceCode);
        for (let d of project.getPreEmitDiagnostics()) {
            console.log('compile diagnostics: ' + d.getMessageText());
        }
        for (let item of sourceCodeInfo.lookPositions) {
            it('test look pos:' + item.name, function () {
                let ref = ls.getApplicableRefactors(sourceCodeInfo.fileName, item.pos, {});
                let edits = ls.getEditsForRefactor(sourceCodeInfo.fileName, {}, item.pos, 'generate-switch-case', 'generate-switch-case', {});
                let result = sourceCodeInfo.mapping[item.name];
                if (!result || result.items.length === 0) {
                    assert(!util.hasRefactorInfo(ref), 'should not has result');
                }
                else {
                    assert(util.hasRefactorInfo(ref), 'should has result:' + result.items.join(','));
                    assert.equal(edits.edits.length, 1, 'edits length must be 1');
                    assert.equal(edits.edits[0].textChanges.length, 1, 'textChanges length must be 1');
                    let actualGenCases = util.extractAllCaseItems(edits.edits[0].textChanges[0].newText);
                    if (!util.arrayEqual(actualGenCases, result.items)) {
                        assert(0, '\nwant result:' + result.items.join(',') + '\nactual result: ' + actualGenCases.join(','));
                    }
                }
            });
        }
    });
}
TestWithFile(__dirname + '/data/sample.ts');
