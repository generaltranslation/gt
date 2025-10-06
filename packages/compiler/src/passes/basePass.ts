import { TransformState } from '../state/types';
import { TraverseOptions } from '@babel/traverse';
import * as p from '../processing';

export function basePass(state: TransformState): TraverseOptions {
  return {
    // Initialize trackers for this program
    Program: p.processProgram(state),

    /* ----------------------------- */
    /* Scope management */
    /* ----------------------------- */

    // for(let T in obj) { ... }
    ForStatement: p.processScopeChange(state),
    // while(T) { ... }
    WhileStatement: p.processScopeChange(state),
    // switch(T) { ... }
    SwitchStatement: p.processScopeChange(state),
    // { ... }
    BlockStatement: p.processScopeChange(state),
    // static { ... }
    StaticBlock: p.processScopeChange(state),

    /* ----------------------------- */
    /* Shadowing tracking */
    /* ----------------------------- */

    // --- Function Processing --- //
    // function T() { ... }
    FunctionDeclaration: p.processFunctionDeclaration(state),
    // const a = function T() {...}
    FunctionExpression: p.processFunctionExpression(state),
    // () => {...}
    ArrowFunctionExpression: p.processArrowFunctionExpression(state),
    // { T() {} } in objects
    ObjectMethod: p.processObjectMethod(state),
    // Class GT { T() { ... } } in classes
    ClassMethod: p.processClassMethod(state),
    // Class GT { #T() {...} }
    ClassPrivateMethod: p.processClassPrivateMethod(state),

    // --- Other Processing --- //
    // import T from '...'
    ImportDeclaration: p.processImportDeclaration(state),
    // let t = useGT(); t = undefined;
    AssignmentExpression: p.processAssignmentExpression(state),
    // class T { ... }
    ClassDeclaration: p.processClassDeclaration(state),
    // for(let T in obj) { ... }
    ForInStatement: p.processForInStatement(state),
    // for(let T of items) { ... }
    ForOfStatement: p.processForOfStatement(state),
    // try { ... } catch(T) { ... }
    CatchClause: p.processCatchClause(state),
  };
}
