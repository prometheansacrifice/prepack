/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

/* @flow */

import type { Realm } from "../realm.js";
import type { LexicalEnvironment } from "../environment.js";
import type { Value } from "../values/index.js";
import type { Reference } from "../environment.js";
import {
    AbruptCompletion,
    NormalCompletion,
    Completion
} from "../completions.js";
import invariant from "../invariant.js";

import {
    NullValue,
    EmptyValue,
    StringValue,


    FunctionValue,


    
} from "../values/index.js";

import {
    DefinePropertyOrThrow,
    FunctionCreate,
    SetFunctionName,
    MakeMethod,
    MakeConstructor,
    Get,
    ObjectCreate,
    CreateMethodProperty
} from "../methods/index.js";


import {
    NewDeclarativeEnvironment,
    IsConstructor,
} from "../methods/index.js";

import IsStrict from "../utils/strict.js";

import type { BabelNodeClassDeclaration } from "babel-types";




function IsStatic(m) {
    return m.static === true;
}

function DefineMethod(realm, env, method, object, strictCode, functionPrototype)     {
    // 1. Let propKey be the result of evaluating PropertyName.
    let propKey = EvalPropertyName(method, env, realm, strictCode);

    // 2. ReturnIfAbrupt(propKey).

    // 3. If the function code for this MethodDefinition is strict mode code, let strict be true. Otherwise let strict be false.
    let strict = IsStrict(method.body);

    // 4. Let scope be the running execution context's LexicalEnvironment.
    let scope = env;

    // 5. If functionPrototype was passed as a parameter, let kind be Normal; otherwise let kind be Method.
    let kind = functionPrototype ? "normal": "method";

    // 6. Let closure be FunctionCreate(kind, StrictFormalParameters, FunctionBody, scope, strict). If functionPrototype was passed as a parameter, then pass its value as the prototype optional argument of FunctionCreate.
    let closure = FunctionCreate(
        realm,
        kind,
        method.params,
        method.body,
        scope,
        strict,
        functionPrototype
    );

    // 7. Perform MakeMethod(closure, object).
    MakeMethod(realm, closure, object);

    // 8. Return the Record{[[Key]]: propKey, [[Closure]]: closure}.
    return { $Key: propKey, $Closure: closure };
}



function PropertyDefinitionEvaluation(realm, env, method, object, enumerable, strictCode) {

    // 1. Let methodDef be DefineMethod of MethodDefinition with argument object.
    let methodDef = DefineMethod(realm, env, method, object, strictCode);

    // 2. ReturnIfAbrupt(methodDef).

    // 3. Perform SetFunctionName(methodDef.[[closure]], methodDef.[[key]]).
    SetFunctionName(realm, methodDef.$Closure, methodDef.$Key);
    
    // 4. Let desc be the Property Descriptor{[[Value]]: methodDef.[[closure]], [[Writable]]: true, [[Enumerable]]: enumerable, [[Configurable]]: true}.
    let desc = {
        value: methodDef.$Closure,
        writable: true,
        enumerable: true,
        configurable: true
    };

    // 5. Return DefinePropertyOrThrow(object, methodDef.[[key]], desc).
     return DefinePropertyOrThrow(realm, object, methodDef.$Key, desc);
};



function MakeClassConstructor(realm: Realm, F: FunctionValue) {
    // 1. Assert: F is an ECMAScript function object.
    invariant(F instanceof FunctionValue, "expected function value");

    // 2. Assert: F’s [[FunctionKind]] internal slot is "normal".
    invariant(F.$FunctionKind === "normal", "expected normal");

    // 3. Set F’s [[FunctionKind]] internal slot to "classConstructor".
    F.$FunctionKind = "classConstructor";

    // 4. Return NormalCompletion(undefined).
    /* return NormalCompletion(realm.intrinsics.undefined);*/
    return realm.intrinsics.undefined;
};



// Returns the result of evaluating PropertyName.
function EvalPropertyName(prop: BabelNodeObjectProperty | BabelNodeObjectMethod, env: LexicalEnvironment, realm: Realm, strictCode: boolean): PropertyKeyValue {
  if (prop.computed) {
    let propertyKeyName = GetValue(realm, env.evaluate(prop.key, strictCode)).throwIfNotConcrete();
    return ToPropertyKey(realm, propertyKeyName);
  } else {
    if (prop.key.type === "Identifier") {
      return new StringValue(realm, prop.key.name);
    } else {
      return ToStringPartial(realm, GetValue(realm, env.evaluate(prop.key, strictCode)));
    }
  }
}




export default function (ast: BabelNodeClassDeclaration, strictCode: boolean, env: LexicalEnvironment, realm: Realm): Value | Reference {

    // 1. Let lex be the LexicalEnvironment of the running execution context.
    let lex: LexicalEnvironment = env;

    // 2. Let classScope be NewDeclarativeEnvironment(lex).
    let classScope = NewDeclarativeEnvironment(realm, lex);

    // 3. Let classScopeEnvRec be classScope’s EnvironmentRecord.
    let classScopeEnvRec = classScope.environmentRecord;

    // 4. If className is not undefined, then perform classScopeEnvRec.CreateImmutableBinding(className, true).
    if (!ast.id) { //TODO(psacrifce) typeof?
        classScopeEnvRec.CreateImmutableBinding(ast.id, true);
    }

    // 5. If ClassHeritageopt is not present, then
    let protoParent, constructorParent, superclass; // TODO(psacrifice) let declaration
    if (!ast.superClass) {
        // a. Let protoParent be the intrinsic object %ObjectPrototype%.
        protoParent= realm.intrinsics.ObjectPrototype;
        // b. Let constructorParent be the intrinsic object %FunctionPrototype%
        constructorParent = realm.intrinsics.FunctionPrototype
    }

    // 6. Else
    else {
        // a. Set the running execution context’s LexicalEnvironment to classScope.
        realm.getRunningContext().lexicalEnvironment = classScope;

        // b. Let superclass be the result of evaluating ClassHeritage.
        superclass = ast.superClass;

        // c. Set the running execution context’s LexicalEnvironment to lex.
        realm.getRunningContext().lexicalEnvironment = lex;

        // d. ReturnIfAbrupt(superclass).
        // Not necessary? Why?

        // e. If superclass is null, then 
        if (superclass instanceof NullValue) {
            // i. Let protoParent be null.
            protoParent = realm.intrinsics.null;
            // ii. Let constructorParent be the intrinsic object %FunctionPrototype%.
            constructorParent = realm.intrinsics.FunctionPrototype
        }

        // f. Else if IsConstructor(superclass) is false, throw a TypeError exception.
        if (IsConstructor(realm, superclass) === false) {
            throw realm.createErrorThrowCompletion(realm.intrinsics.TypeError);
        }

        // Else
        else {
            // i. If superclass has a [[FunctionKind]] internal slot whose value is "generator", throw a TypeError exception.
            if (superclass.$FunctionKind === 'generator') {
                throw realm.createErrorThrowCompletion(realm.intrinsics.TypeError);
            }

            // ii. Let protoParent be Get(superclass, "prototype").
            protoParent = Get(superclass, "prototype");

            // iii. ReturnIfAbrupt(protoParent).

            // iv. If Type(protoParent) is neither Object nor Null, throw a TypeError exception.
            if (Type(protoParent) instanceof ObjectValue ||
                Type(protoParent) instanceof NullValue) {
                throw realm.createErrorThrowCompletion(realm.intrinsics.TypeError);
            }

            // v. Let constructorParent be superclass.
            constructorParent = superclass;
        }
    }

    // 7. Let proto be ObjectCreate(protoParent).
    let proto = ObjectCreate(realm, protoParent);

    // 8. If ClassBodyopt is not present, let constructor be empty.
    let constructor;
    if (!ast.body) {
        constructor = realm.intrinsics.empty;
    }

    // 9. Else, let constructor be ConstructorMethod of ClassBody.
    else {
        constructor = ast.body.body.filter(b => b.kind === 'constructor')[0]; // TODO(psacrific) for loop.
    }

    // 10. If constructor is empty, then,
    if (constructor instanceof EmptyValue) {
        /*        
           If ClassHeritageopt is present, then
           Let constructor be the result of parsing the source text
           constructor(... args){ super (...args);}
           using the syntactic grammar with the goal symbol MethodDefinition.
           Else,
           Let constructor be the result of parsing the source text
           constructor( ){ }
           using the syntactic grammar with the goal symbol MethodDefinition.
         */

        // Refer https://github.com/facebook/prepack/blob/master/src/utils/parse.js
        // Lexicalenvironment.execute() https://github.com/facebook/prepack/blob/master/src/environment.js#L989
    }

    // 11. Set the running execution context’s LexicalEnvironment to classScope.
    realm.getRunningContext().lexicalEnvironment = classScope;

    // 12. Let constructorInfo be the result of performing DefineMethod for constructor with arguments proto and constructorParent as the optional functionPrototype argument.
    let constructorInfo = DefineMethod(realm, env, constructor, proto, strictCode, constructorParent);

    // 13. Assert: constructorInfo is not an abrupt completion.
    invariant(!(constructorInfo instanceof AbruptCompletion)); //, "expected function value");

    // 14. Let F be constructorInfo.[[closure]]
    let F = constructorInfo.$Closure;

    // 15. If ClassHeritageopt is present, set F’s [[ConstructorKind]] internal slot to "derived".
    if (ast.superClass) {
        F.$ConstructorKind = "derived";
    }

    // 16. Perform MakeConstructor(F, false, proto).
    MakeConstructor(realm, F, false, proto);

    // 17. Perform MakeClassConstructor(F).
    MakeClassConstructor(realm, F);

    // 18. Perform CreateMethodProperty(proto, "constructor", F).
    CreateMethodProperty(realm, proto, "constructor", F);

    // 19. If ClassBodyopt is not present, let methods be a new empty List.
    let methods;
    if (!ast.body) {
        methods = [];
    }

    // 20. Else, let methods be NonConstructorMethodDefinitions of ClassBody.
    else {
        methods = ast.body.body.filter(b => b.kind === 'constructor'); // TODO(psacrifice
    }

    // 21. For each ClassElement m in order from methods
    // 
    // If IsStatic of m is false, then
    // Let status be the result of performing PropertyDefinitionEvaluation for m with arguments proto and false.
    // Else,
    // Let status be the result of performing PropertyDefinitionEvaluation for m with arguments F and false.
    // If status is an abrupt completion, then
    // Set the running execution context’s LexicalEnvironment to lex.
    // Return Completion(status).

    for(let i = 0; i < methods.length; i++) {
        const m = methods[i];
        let status;

        // a. If IsStatic of m is false, then
        //    Let status be the result of performing PropertyDefinitionEvaluation for m with arguments proto and false.
        if (!IsStatic(m)) {
            status = PropertyDefinitionEvaluation(realm, env, m, proto, false, strictCode);
        }

        // b. Else,
        // Let status be the result of performing PropertyDefinitionEvaluation for m with arguments F and false.
        
        else {
            status = PropertyDefinitionEvaluation(realm, env, m, F, false, strictCode);
        }

        // c. If status is an abrupt completion, then
        // Set the running execution context’s LexicalEnvironment to lex.
        // Return Completion(status).
        if (status instanceof AbruptCompletion) {
            realm.getRunningContext().lexicalEnvironment = lex;
            return Completion(status);
        }
    }


    // 22. Set the running execution context’s LexicalEnvironment to lex.
    realm.getRunningContext().lexicalEnvironment = lex;

    // 23. If className is not undefined, then
    // Perform classScopeEnvRec.InitializeBinding(className, F).
    if(!ast.id) {
        throw new Error('No ClassName')
    }

    // 24. Return F.
    return F;

}
