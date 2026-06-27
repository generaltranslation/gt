import { TransformState } from '../state/types';
import { TraverseOptions } from '@babel/traverse';
import { processProgram } from '../processing/processProgram';
import { processScopeChange } from '../processing/processScopeChange';
import { processFunctionDeclaration } from '../processing/processFunctionDeclaration';
import { processFunctionExpression } from '../processing/processFunctionExpression';
import { processArrowFunctionExpression } from '../processing/processArrowFunctionExpression';
import { processObjectMethod } from '../processing/processObjectMethod';
import { processClassMethod } from '../processing/processClassMethod';
import { processClassPrivateMethod } from '../processing/processClassPrivateMethod';
import { processImportDeclaration } from '../processing/processImportDeclaration';
import { processAssignmentExpression } from '../processing/processAssignmentExpression';
import { processClassDeclaration } from '../processing/processClassDeclaration';
import { processForInStatement } from '../processing/processForInStatement';
import { processForOfStatement } from '../processing/processForOfStatement';
import { processCatchClause } from '../processing/processCatchClause';

export function basePass(state: TransformState): TraverseOptions {
  return {
    // Initialize trackers for this program
    Program: processProgram(state),

    /* ----------------------------- */
    /* Scope management */
    /* ----------------------------- */

    // for(let T in obj) { ... }
    ForStatement: processScopeChange(state),
    // while(T) { ... }
    WhileStatement: processScopeChange(state),
    // switch(T) { ... }
    SwitchStatement: processScopeChange(state),
    // { ... }
    BlockStatement: processScopeChange(state),
    // static { ... }
    StaticBlock: processScopeChange(state),

    /* ----------------------------- */
    /* Shadowing tracking */
    /* ----------------------------- */

    // --- Function Processing --- //
    // function T() { ... }
    FunctionDeclaration: processFunctionDeclaration(state),
    // const a = function T() {...}
    FunctionExpression: processFunctionExpression(state),
    // () => {...}
    ArrowFunctionExpression: processArrowFunctionExpression(state),
    // { T() {} } in objects
    ObjectMethod: processObjectMethod(state),
    // Class GT { T() { ... } } in classes
    ClassMethod: processClassMethod(state),
    // Class GT { #T() {...} }
    ClassPrivateMethod: processClassPrivateMethod(state),

    // --- Other Processing --- //
    // import T from '...'
    ImportDeclaration: processImportDeclaration(state),
    // let t = useGT(); t = undefined;
    AssignmentExpression: processAssignmentExpression(state),
    // class T { ... }
    ClassDeclaration: processClassDeclaration(state),
    // for(let T in obj) { ... }
    ForInStatement: processForInStatement(state),
    // for(let T of items) { ... }
    ForOfStatement: processForOfStatement(state),
    // try { ... } catch(T) { ... }
    CatchClause: processCatchClause(state),
  };
}
