enum EnumType
{
	A, B, C
}
namespace YY
{
	export enum InYYEnumType
	{
		A, B, C
	}
}
type Union1 = 1 | 2 | 3;
function test001(x: EnumType)
{
	switch/*a*/(x)
	{

	}

	let y: Union1;
	switch/*b*/(y)
	{

	}
}

function test002(x: boolean, y: true | 1 | 2, z: EnumType | 1 | false, w: "abc" | 1)
{
	switch (/*x*/x) { }
	switch (/*y*/y) { }
	switch (/*z*/z) { }
	switch (/*w*/w) { }
}

namespace YY
{
	function test003(x: YY.InYYEnumType)
	{
		switch (/*1*/x)
		{
		}
	}
}

function test004(x: YY.InYYEnumType)
{

	switch (/*2*/x)
	{
		//should generate with namespace
	}
}

function test005(x: YY.InYYEnumType | EnumType)
{

	switch (/*3*/x)
	{
		//should generate with namespace
	}
}

function test006(x: 1 | 2)
{
	switch (/*4*/x)
	{
		case 1: break;
		case 2: break;
		default: break;
	}

	switch (/*5*/x)
	{
		case 1: x++;
	}
}

//a => [EnumType.A,EnumType.B,EnumType.C]
//b => [1,2,3]
//x => [true,false]
//y => [true,1,2]
//z => [EnumType.A,EnumType.B,EnumType.C,1,false]
//w => ["abc",1]
//1 => [InYYEnumType.A,InYYEnumType.B,InYYEnumType.C]
//2 => [YY.InYYEnumType.A,YY.InYYEnumType.B,YY.InYYEnumType.C]
//3 => [YY.InYYEnumType.A,YY.InYYEnumType.B,YY.InYYEnumType.C,EnumType.A,EnumType.B,EnumType.C]
//4 => [1,2]
//5 => []

