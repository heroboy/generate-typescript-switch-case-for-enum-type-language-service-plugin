"use strict";
//import { TypeChecker, Expression } from 'typescript/lib/tsserverlibrary'
function init(modules) {
    const ts = modules.typescript;
    function create(info) {
        const proxy = Object.create(null);
        for (let k of Object.keys(info.languageService)) {
            const x = info.languageService[k];
            proxy[k] = (...args) => x.apply(info.languageService, args);
        }
        function extractEnumInfo(fileName, positionOrRange, simple) {
            const sourceFile = info.languageService.getProgram().getSourceFile(fileName);
            if (!sourceFile)
                return false;
            let nodeAtCursor = findChildContainingPosition(sourceFile, positionOrRangeToNumber(positionOrRange));
            while (nodeAtCursor &&
                !ts.isSwitchStatement(nodeAtCursor)) {
                nodeAtCursor = nodeAtCursor.parent;
            }
            if (nodeAtCursor &&
                ts.isSwitchStatement(nodeAtCursor) &&
                nodeAtCursor.caseBlock.clauses.length === 0 &&
                nodeAtCursor.caseBlock.getChildCount() === 3) // ===3 mease clauses is empty. only ['{', SyntaxList, '}']
             {
                let typeChecker = info.languageService.getProgram().getTypeChecker();
                let expType = typeChecker.getTypeAtLocation(nodeAtCursor.expression);
                let list = extractEnumMemberList(expType, typeChecker, nodeAtCursor);
                if (list) {
                    if (simple)
                        return true;
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
        proxy.getApplicableRefactors = (fileName, positionOrRange) => {
            const refactors = info.languageService.getApplicableRefactors(fileName, positionOrRange, undefined) || [];
            const sourceFile = info.languageService.getProgram().getSourceFile(fileName);
            if (!sourceFile) {
                return refactors;
            }
            if (extractEnumInfo(fileName, positionOrRange, true)) {
                refactors.push({
                    name: 'generate-switch-case',
                    description: 'generate switch case desc',
                    actions: [{ name: 'generate-switch-case', description: 'Generate Switch Case' }],
                });
            }
            return refactors;
        };
        proxy.getEditsForRefactor = (fileName, formatOptions, positionOrRange, refactorName, actionName, preferences) => {
            const refactors = info.languageService.getEditsForRefactor(fileName, formatOptions, positionOrRange, refactorName, actionName, preferences);
            if (actionName === 'generate-switch-case') {
                let obj = extractEnumInfo(fileName, positionOrRange, false);
                if (obj) {
                    if (1) {
                        const sourceFile = info.languageService.getProgram().getSourceFile(fileName);
                        let clause = [];
                        obj.nodeList.forEach(item => {
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
                        }, (tracker) => {
                            //tracker.insertNodesAt(sourceFile, obj.pos, clause, {});
                            //tracker.replaceNode(sourceFile, obj.caseBlockNode, caseBlockNode, {});
                            tracker.replaceNode(sourceFile, obj.switchNode, switchNode, undefined);
                        });
                        return { edits };
                    }
                    else {
                        // let newText = [];
                        // let indent = info.languageService.getIndentationAtPosition(fileName, obj.pos, formatOptions) + formatOptions.indentSize;
                        // let indentText = '';
                        // for (let i = 0; i < indent; ++i)
                        // {
                        // 	indentText += ' ';
                        // }
                        // newText.push(formatOptions.newLineCharacter);
                        // obj.list.forEach(item =>
                        // {
                        // 	newText.push(indentText + 'case ' + item + ': break;' + formatOptions.newLineCharacter);
                        // })
                        // newText.push(indentText + 'default: break;');
                        // return {
                        // 	edits: [
                        // 		{
                        // 			fileName,
                        // 			textChanges: [
                        // 				{
                        // 					span: { start: obj.pos, length: 0 },
                        // 					newText: newText.join('')
                        // 				}
                        // 			]
                        // 		}
                        // 	]
                        // }
                    }
                }
            }
            return refactors;
        };
        return proxy;
    }
    function extractEnumMemberList(type, typeChecker, node) {
        let list;
        /*
         support
         Enum
         {
            A,B,C
         }
         */
        if (type.flags & ts.TypeFlags.EnumLike) {
            if (type.aliasSymbol && type.aliasSymbol.exports) {
                list = [];
                type.aliasSymbol.exports.forEach(t => {
                    list.push(typeChecker.symbolToExpression(t, 0, node));
                });
                return list;
            }
        }
        /*
            support
            type Union = 1|2|true;

            boolean is a Union => true|false
         */
        else if (type.flags & ts.TypeFlags.Union) {
            const trueType = typeChecker['getTrueType']();
            const falseType = typeChecker['getFalseType']();
            let unionType = type;
            let isAllLiterial = unionType.types.every(t => {
                let flag = t.flags;
                return (flag & ts.TypeFlags.NumberLiteral) || (flag & ts.TypeFlags.StringLiteral) || t === trueType || t === falseType;
            });
            if (isAllLiterial) {
                return unionType.types.map(t => {
                    let lt = t;
                    if (t.symbol)
                        return typeChecker.symbolToExpression(t.symbol, 0, node);
                    if (t === trueType)
                        return ts.createTrue();
                    if (t === falseType)
                        return ts.createFalse();
                    return ts.createLiteral(lt.value);
                });
            }
        }
        return;
    }
    // Helper functions used in this tutorial
    /**normalize the parameter so we are sure is of type Range */
    function positionOrRangeToRange(positionOrRange) {
        return typeof positionOrRange === 'number'
            ? { pos: positionOrRange, end: positionOrRange }
            : positionOrRange;
    }
    /**normalize the parameter so we are sure is of type number */
    function positionOrRangeToNumber(positionOrRange) {
        return typeof positionOrRange === 'number' ?
            positionOrRange :
            positionOrRange.pos;
    }
    /** from given position we find the child node that contains it */
    function findChildContainingPosition(sourceFile, position) {
        function find(node) {
            if (position >= node.getStart() && position < node.getEnd()) {
                //return ts.forEachChild(node, find) || node
                return node.forEachChild(find) || node;
            }
        }
        return find(sourceFile);
    }
    return { create };
}
module.exports = init;
