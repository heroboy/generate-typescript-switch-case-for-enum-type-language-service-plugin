import * as fs from 'fs';
import * as ts from 'typescript/lib/tsserverlibrary'
interface SourceCodeInfo
{
	fileName: string;
	sourceCode: string;
	lookPositions: {
		name: string;
		pos: number;
	}[];

	mapping: {
		[key: string]: {
			items: string[]
		}
	}
}

export function loadSource(fileName: string): SourceCodeInfo
{
	let sourceCode = fs.readFileSync(fileName, { encoding: 'utf8' });
	let lookPositions: {
		name: string;
		pos: number;
	}[] = [];
	//  /*a*/
	const re_lookPos = /\/\*([a-zA-Z0-9]{1,2})\*\//;
	while (true)
	{
		let m = re_lookPos.exec(sourceCode);
		if (!m) break;
		lookPositions.push({
			name: m[1],
			pos: m.index
		});
		sourceCode = sourceCode.slice(0, m.index) + sourceCode.slice(m.index + m[0].length);
	}


	//
	const re_result = /^\s*\/\/\s*([a-zA-Z0-9]{1,2})\s*=>\s*\[([^\]]*)\]/gm;
	let mm: RegExpExecArray;
	let mapping: SourceCodeInfo['mapping'] = {};
	do 
	{
		mm = re_result.exec(sourceCode)
		if (mm)
		{
			mapping[mm[1]] = {
				items: mm[2].split(',').map(s => s.trim())
			};
			if (mm[2].trim() === '')
			{
				mapping[mm[1]] = {
					items: []
				};
			}
		}
	} while (mm);

	return {
		fileName,
		sourceCode,
		lookPositions,
		mapping
	}
}

// extract code like case XXX.YYY:" return ["XXX.YYY"]
export function extractAllCaseItems(code: string): string[]
{
	let ret = [];
	let re = /\s+case\s+([\w\."'`]*):/g;
	let m: RegExpExecArray;
	do
	{
		m = re.exec(code);
		if (m)
		{
			ret.push(m[1]);
		}
	}
	while (m);
	return ret;
}

export function hasRefactorInfo(info: ts.ApplicableRefactorInfo[])
{
	if (info)
	{
		for (let ref of info)
		{
			if (ref.name === 'generate-switch-case')
				return true;
		}
	}
	return false;
}

export function arrayEqual(arr1: string[], arr2: string[])
{
	if (arr1.length !== arr2.length) return false;
	arr1 = arr1.slice();
	arr2 = arr2.slice();
	arr1.sort();
	arr2.sort();
	for (let i = 0; i < arr1.length; ++i)
	{
		if (arr1[i] !== arr2[i])
			return false;
	}
	return true;
}