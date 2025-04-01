grammar SimpleLang;

prog: statement*;

statement:
	letDecl
	| assign
	| funcDef
	| ifStmt
	| whileStmt
	| matchStmt
	| structDef
	| enumDef
	| returnStmt
	| expressionStmt
	| block;

letDecl: 'let' ('mut')? ID (':' type)? ('=' expression)? ';';

assign: ID '=' expression ';';

funcDef: 'fn' ID '(' (paramList)? ')' ('->' type)? block;

paramList: param (',' param)*;
param: ID ':' type;

type:
	'i32'
	| 'f64'
	| 'bool'
	| 'String'
	| '&' type
	| '&' 'mut' type
	| 'Box' '<' type '>'
	| 'Rc' '<' type '>';

structDef: 'struct' ID '{' structField (',' structField)* '}';
structField: ID ':' type;

enumDef: 'enum' ID '{' enumVariant (',' enumVariant)* '}';
enumVariant: ID ('(' paramList ')')?;

matchStmt: 'match' expression '{' matchArm+ '}';
matchArm: pattern '=>' expression ',';
pattern: ID | INT | STRING | '_';

ifStmt: 'if' expression block ('else' block)?;

whileStmt: 'while' expression block;

block: '{' statement* '}';

returnStmt: 'return' expression? ';';

expressionStmt: expression ';';

expression:
	expression op = ('*' | '/') expression									# MulDiv
	| expression op = ('+' | '-') expression								# AddSub
	| expression op = ('==' | '!=' | '<' | '>' | '<=' | '>=') expression	# Compare
	| expression op = ('&&' | '||') expression								# Logical
	| ID '(' (argList)? ')'													# FunctionCall
	| '&' expression														# Borrow
	| '&' 'mut' expression													# MutableBorrow
	| 'Box' '::' 'new' '(' expression ')'									# HeapAlloc
	| 'Rc' '::' 'new' '(' expression ')'									# RcAlloc
	| op = ('!' | '-') expression											# UnaryOp
	| '(' expression ')'													# Parens
	| BOOL																	# Bool
	| INT																	# Int
	| STRING																# Str
	| ID																	# Id;

argList: expression (',' expression)*;

MUL: '*';
DIV: '/';
ADD: '+';
SUB: '-';
EQ: '==';
NEQ: '!=';
LT: '<';
GT: '>';
LE: '<=';
GE: '>=';
AND: '&&';
OR: '||';
NOT: '!';
BOOL: 'true' | 'false';
INT: [0-9]+;
STRING: '"' .*? '"';
ID: [a-zA-Z_][a-zA-Z0-9_]*;
WS: [ \t\r\n]+ -> skip;