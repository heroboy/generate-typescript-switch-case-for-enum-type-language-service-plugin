import * as fs from 'fs'
import * as ts from 'typescript/lib/tsserverlibrary'
import * as util from './util'
import * as assert from 'assert';
const myplugin = require('../index');
import { Project } from 'ts-morph'

function TestWithFile(fileName: string)
{
	describe("Test file:" + fileName, function ()
	{
		let project = new Project({ useInMemoryFileSystem: true });
		let info: ts.server.PluginCreateInfo = {
			project: null,
			languageService: project.getLanguageService().compilerObject,
			languageServiceHost: project.getLanguageService()['_languageServiceHost'],
			serverHost: null,
			config: {}
		};
		let ls: ts.LanguageService = myplugin({ typescript: ts }).create(info)
		let sourceCodeInfo = util.loadSource(fileName);
		it('assert loadSource corrent', function ()
		{
			for (let obj of sourceCodeInfo.lookPositions)
			{
				assert(sourceCodeInfo.mapping[obj.name], `pos '${obj.name}' must exists`);
			}
		});


		project.createSourceFile(sourceCodeInfo.fileName, sourceCodeInfo.sourceCode);

		for (let d of project.getPreEmitDiagnostics())
		{
			console.log('compile diagnostics: ' + d.getMessageText());
		}
		for (let item of sourceCodeInfo.lookPositions)
		{
			it('test look pos:' + item.name, function ()
			{
				let ref = ls.getApplicableRefactors(sourceCodeInfo.fileName, item.pos, {});
				let edits = ls.getEditsForRefactor(sourceCodeInfo.fileName, {}, item.pos, 'generate-switch-case', 'generate-switch-case', {});
				let result = sourceCodeInfo.mapping[item.name];
				if (!result || result.items.length === 0)
				{
					assert(!util.hasRefactorInfo(ref), 'should not has result');
				}
				else
				{
					assert(util.hasRefactorInfo(ref), 'should has result:' + result.items.join(','));
					assert.equal(edits.edits.length, 1, 'edits length must be 1');
					assert.equal(edits.edits[0].textChanges.length, 1, 'textChanges length must be 1');
					let actualGenCases = util.extractAllCaseItems(edits.edits[0].textChanges[0].newText);
					if (!util.arrayEqual(actualGenCases,result.items))
					{
						assert(0,'\nwant result:' + result.items.join(',') + '\nactual result: ' + actualGenCases.join(','));
					}
				}
			});

		}
	})
}

TestWithFile(__dirname + '/data/sample.ts');

