grammar SimpleLang;

prog: statement* EOF;

statement
    : expressionStmt 
    // | fnDecl
    // | whileStmt
    // | ifStmt
    // | block
    ;

expressionStmt
    : expression ';'
    ;

expression
    : expression op=('*'|'/') expression # MulDiv
    | expression op=('+'|'-') expression # AddSub
    | INT # int
    | ID # id
    | '(' expression ')' # parens
    ;

ID: [a-zA-Z]+; // match identifiers
INT: [0-9]+;
WS: [ \t\r\n]+ -> skip;
ADD: '+';
SUB: '-';
MUL: '*';
DIV: '/';
