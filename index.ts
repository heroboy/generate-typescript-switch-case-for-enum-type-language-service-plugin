//import { TypeChecker, Expression } from 'typescript/lib/tsserverlibrary'

function init(modules: { typescript: typeof import('typescript/lib/tsserverlibrary') })
{
	const ts = modules.typescript
	function create(info: ts.server.PluginCreateInfo): ts.LanguageService
	{
		const proxy: ts.LanguageService = Object.create(null)
		for (let k of Object.keys(info.languageService) as Array<keyof ts.LanguageService>)
		{
			const x = info.languageService[k]
			proxy[k] = (...args: Array<{}>) => x!.apply(info.languageService, args)
		}

		interface IGenInfo
		{
			pos: number;
			//list: string[];
			caseBlockNode: ts.Node;
			nodeList: ts.Expression[];
			switchNode: ts.SwitchStatement;
		}
		function isEmptyCaseBlock(node: ts.SwitchStatement)
		{
			for (let c of node.caseBlock.clauses)
			{
				for (let s of c.statements)
				{
					if (!ts.isBreakStatement(s))
						return false;
				}
			}
			return node.caseBlock.getChildCount() === 3;// ===3 mease clauses is empty. only ['{', SyntaxList, '}']
		}

		function extractEnumInfo(fileName: string, positionOrRange: number | ts.TextRange, simple: false): IGenInfo;
		function extractEnumInfo(fileName: string, positionOrRange: number | ts.TextRange, simple: true): boolean
		function extractEnumInfo(fileName: string, positionOrRange: number | ts.TextRange, simple: boolean): boolean | IGenInfo
		{
			const sourceFile = info.languageService.getProgram().getSourceFile(fileName)
			if (!sourceFile) return false;

			let nodeAtCursor = findChildContainingPosition(sourceFile, positionOrRangeToNumber(positionOrRange))
			while (nodeAtCursor &&
				!ts.isSwitchStatement(nodeAtCursor))
			{
				nodeAtCursor = nodeAtCursor.parent;
			}
			//Is the node is an empty switch statement?
			if (nodeAtCursor &&
				ts.isSwitchStatement(nodeAtCursor) &&
				isEmptyCaseBlock(nodeAtCursor))// ===3 mease clauses is empty. only ['{', SyntaxList, '}']
			{
				let typeChecker = info.languageService.getProgram().getTypeChecker();
				let expType = typeChecker.getTypeAtLocation(nodeAtCursor.expression);
				//Is the exp type is an Enum type?
				let list = extractEnumMemberList(expType, typeChecker, nodeAtCursor);
				if (list)
				{
					if (simple) return true;
					let pos = nodeAtCursor.caseBlock.getStart() + 1;
					return { pos, caseBlockNode: nodeAtCursor.caseBlock, nodeList: list, switchNode: nodeAtCursor };
				}
				// if (expType.flags & ts.TypeFlags.Literal)
				// {
				// 	expType = (expType as ts.LiteralType).regularType;
				// }
				// if ((expType.flags & ts.TypeFlags.EnumLike) &&
				// 	expType.aliasSymbol)
				// {
				// 	if (simple)
				// 	{
				// 		return true;
				// 	}

				// 	let t2 = expType;
				// 	if (t2.aliasSymbol)
				// 	{
				// 		let pos = nodeAtCursor.caseBlock.getStart() + 1;
				// 		let list: string[] = [];
				// 		let nodeList: ts.Expression[] = [];
				// 		t2.aliasSymbol.exports.forEach(t =>
				// 		{
				// 			list.push(typeChecker.symbolToString(t, nodeAtCursor));
				// 			nodeList.push(typeChecker.symbolToExpression(t, 0, nodeAtCursor));
				// 		});
				// 		//let list = t2.types.map(t => typeChecker.typeToString(t));

				// 		return { pos, list, caseBlockNode: nodeAtCursor.caseBlock, nodeList, switchNode: nodeAtCursor }
				// 	}
			}
		}


		// Here starts our second behavior: a refactor that will always be suggested no matter where is the cursor and does nothing
		// overriding getApplicableRefactors we add our refactor metadata only if the user has the cursor on the place we desire, in our case a class or interface declaration identifier
		proxy.getApplicableRefactors = (fileName, positionOrRange): ts.ApplicableRefactorInfo[] =>
		{

			const refactors = info.languageService.getApplicableRefactors(fileName, positionOrRange, undefined) || []
			const sourceFile = info.languageService.getProgram().getSourceFile(fileName)
			if (!sourceFile)
			{
				return refactors
			}

			if (extractEnumInfo(fileName, positionOrRange, true))
			{
				refactors.push({
					name: 'generate-switch-case',
					description: 'generate switch case desc',
					actions: [{ name: 'generate-switch-case', description: 'Generate Switch Case' }],
				});
			}

			return refactors
		}

		proxy.getEditsForRefactor = (fileName, formatOptions, positionOrRange, refactorName, actionName, preferences) =>
		{
			const refactors = info.languageService.getEditsForRefactor(fileName, formatOptions, positionOrRange, refactorName, actionName, preferences)
			if (actionName === 'generate-switch-case')
			{
				let obj = extractEnumInfo(fileName, positionOrRange, false);
				if (obj)
				{
					const sourceFile = info.languageService.getProgram().getSourceFile(fileName)
					let clause: ts.CaseOrDefaultClause[] = [];
					obj.nodeList.forEach(item =>
					{
						//ts.createPropertyAccessChain()
						clause.push(ts.createCaseClause(item, [ts.createBreak()]));
					});
					clause.push(ts.createDefaultClause([ts.createBreak()]));
					let caseBlockNode = ts.createCaseBlock(clause);
					let switchNode = ts.createSwitch(ts.getMutableClone(obj.switchNode.expression), caseBlockNode);
					let edits = ts['textChanges'].ChangeTracker.with({
						host: info.languageServiceHost,
						formatContext: ts['formatting'].getFormatContext(formatOptions),
						preferences: preferences
					}, (tracker) =>
					{
						//tracker.insertNodesAt(sourceFile, obj.pos, clause, {});
						//tracker.replaceNode(sourceFile, obj.caseBlockNode, caseBlockNode, {});
						tracker.replaceNode(sourceFile, obj.switchNode, switchNode, undefined);
					});
					return { edits };
				}
			}
			return refactors;
		}


		return proxy
	}

	function extractEnumMemberList(type: ts.Type, typeChecker: ts.TypeChecker, node: ts.Node): ts.Expression[] | undefined
	{
		let list: ts.Expression[];
		//enum is also a union
		if (type.flags & ts.TypeFlags.Union)
		{
			/*
			support
			class A{};
			class B{};
			type Union = 1|2|true|A|B;
			

			boolean is a Union => true|false
		    */
			const trueType = typeChecker['getTrueType']();
			const falseType = typeChecker['getFalseType']();
			let unionType = type as ts.UnionType;
			let isAllLiterial = unionType.types.every(t =>
			{
				let flag = t.flags;

				return (flag & ts.TypeFlags.NumberLiteral) || (flag & ts.TypeFlags.StringLiteral) || t === trueType || t === falseType ||
					(flag & ts.TypeFlags.Object) && ((t as ts.ObjectType).objectFlags & ts.ObjectFlags.Class);//class type. 'class A{}'
			})
			if (isAllLiterial)
			{
				return unionType.types.map(t =>
				{
					let lt = t as ts.LiteralType;
					if (t.symbol) return typeChecker.symbolToExpression(t.symbol, 0, node);
					if (t === trueType) return ts.createTrue();
					if (t === falseType) return ts.createFalse();
					return ts.createLiteral(lt.value)
				})
			}
		}
		return;
	}
	// Helper functions used in this tutorial

	/**normalize the parameter so we are sure is of type Range */
	function positionOrRangeToRange(positionOrRange: number | ts.TextRange): ts.TextRange
	{
		return typeof positionOrRange === 'number'
			? { pos: positionOrRange, end: positionOrRange }
			: positionOrRange
	}

	/**normalize the parameter so we are sure is of type number */
	function positionOrRangeToNumber(positionOrRange: number | ts.TextRange): number
	{
		return typeof positionOrRange === 'number' ?
			positionOrRange :
			(positionOrRange as ts.TextRange).pos
	}

	/** from given position we find the child node that contains it */
	function findChildContainingPosition(sourceFile: ts.SourceFile, position: number): ts.Node | undefined
	{
		function find(node: ts.Node): ts.Node | undefined
		{
			if (position >= node.getStart() && position < node.getEnd())
			{
				//return ts.forEachChild(node, find) || node
				return node.forEachChild(find) || node;
			}
		}

		return find(sourceFile)
	}

	return { create }
}

export = init