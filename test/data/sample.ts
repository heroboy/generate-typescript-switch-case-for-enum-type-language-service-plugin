enum EnumType
{
	A, B, C
}
type Union1 = 1|2|3;
function test001(x: EnumType)
{
	switch/*a*/(x)
	{

	}

	let y:Union1;
	switch/*b*/(y)
	{

	}
}

function test002(x:boolean,y:true|1|2,z:EnumType|1|false,w:"abc"|1)
{
	switch(/*x*/x){}
	switch(/*y*/y){}
	switch(/*z*/z){}
	switch(/*w*/w){}
}


//a => [EnumType.A,EnumType.B,EnumType.C]
//b => [1,2,3]
//x => [true,false]
//y => [true,1,2]
//z => [EnumType.A,EnumType.B,EnumType.C,1,false]
//w => ["abc",1]