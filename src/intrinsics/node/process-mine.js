/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

/* @flow */

import invariant from "../../invariant.js";
import type { Realm } from "../../realm.js";
import {
  AbstractObjectValue,
  AbstractValue,
  ArrayValue,
  BooleanValue,
  ConcreteValue,
  FunctionValue,
  NativeFunctionValue,
  NumberValue,
  ObjectValue,
  StringValue,
} from "../../values/index.js";
import { Get } from "../../methods/index.js";
import { ValuesDomain } from "../../domains/index.js";
import { Properties, To } from "../../singletons.js";
import buildExpressionTemplate from "../../utils/builder.js";
import initializeBuffer from "./buffer.js";
import initializeContextify from "./contextify.js";
import initializeFS from "./fs.js";
import { copyProperty, createDeepIntrinsic } from "./utils.js";

declare var process: any;

function initializeTimerWrap(realm) {
  let obj = new ObjectValue(realm, realm.intrinsics.ObjectPrototype, "process.binding('timer_wrap')");
  let constructor = new NativeFunctionValue(
    realm,
    "process.binding('timer_wrap').Timer",
    "Timer",
    0,
    (context, args) => {
      return realm.intrinsics.undefined;
    }
  );
  Properties.OrdinaryDefineOwnProperty(realm, obj, "Timer", {
    value: constructor,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  // TODO: Implement the rest of this protocol as needed.
  return obj;
}

function initializeTTYWrap(realm) {
  let nativeTTYWrap = process.binding("tty_wrap");
  // let nativeTTY = nativeTTYWrap.TTY;
  let obj = new ObjectValue(realm, realm.intrinsics.ObjectPrototype, "process.binding('tty_wrap')");

  let constructor = new NativeFunctionValue(
    realm,
    "process.binding('tty_wrap').TTY",
    "TTY",
    0,
    (context, args, argCount, NewTarget) => {
      invariant(args[0] instanceof ConcreteValue);
      let fd = To.ToInteger(realm, args[0]);
      invariant(args[1] instanceof ConcreteValue);
      let value = To.ToBoolean(realm, args[1]);

      invariant(NewTarget, "TTY must be called as a constructor.");

      let proto = Get(realm, NewTarget, new StringValue(realm, "prototype"));
      if (!(proto instanceof ObjectValue)) {
        proto = TTYPrototype;
      }

      // TODO: Store nativeTTY in an internal slot so that it can be used if this
      // object gets passed to another native call.

      return new ObjectValue(realm, proto, `new (process.binding('tty_wrap').TTY)(${fd}, ${value.toString()})`);
    }
  );
  Properties.OrdinaryDefineOwnProperty(realm, obj, "TTY", {
    value: constructor,
    writable: true,
    enumerable: true,
    configurable: true,
  });

  let TTYPrototype = new ObjectValue(
    realm,
    realm.intrinsics.ObjectPrototype,
    "process.binding('tty_wrap').TTY.prototype"
  );

  TTYPrototype.defineNativeMethod("setBlocking", 0, (context, args) => {
    return realm.intrinsics.undefined;
  });
  TTYPrototype.defineNativeMethod("getWindowSize", 0, (context, args) => {
    return realm.intrinsics.undefined;
  });
  TTYPrototype.defineNativeMethod("writeUtf8String", 0, (context, args) => {
    // TODO: Store this as a side-effect. When we do that, we need the first arg
    // to be passed along to that side-effect.
    // let req = args[0];
    let content = args[1];
    invariant(content instanceof StringValue);
    return realm.intrinsics.undefined;
  });

  Properties.DefinePropertyOrThrow(realm, constructor, "prototype", {
    value: TTYPrototype,
    writable: true,
    enumerable: false,
    configurable: false,
  });

  obj.defineNativeMethod("guessHandleType", 0, (context, args) => {
    let fd = To.ToInteger(realm, args[0]);
    return new StringValue(realm, nativeTTYWrap.guessHandleType(fd));
    // TODO: Make this abstract so that changing the pipe at runtime is
    // possible. Currently this causes an introspection error.

    // let types = new TypesDomain(StringValue);
    // let values = new ValuesDomain(new Set([
    //   new StringValue(realm, "TCP"),
    //   new StringValue(realm, "TTY"),
    //   new StringValue(realm, "UDP"),
    //   new StringValue(realm, "FILE"),
    //   new StringValue(realm, "PIPE"),
    //   new StringValue(realm, "UNKNOWN")
    // ]));
    // let buildNode = buildExpressionTemplate(
    //   `(process.binding('tty_wrap').guessHandleType(${fd}))`
    // )(this.realm.preludeGenerator);
    // return realm.createAbstract(types, values, [], buildNode, undefined, `(process.binding('tty_wrap').guessHandleType(${fd}))`);
  });

  obj.defineNativeMethod("isTTY", 0, (context, args) => {
    let fd = To.ToInteger(realm, args[0]);
    const isTTYtemplateSrc = `(process.binding('tty_wrap').isTTY(${fd}))`;
    const isTTYtemplate = buildExpressionTemplate(isTTYtemplateSrc);
    let val = AbstractValue.createFromTemplate(realm, isTTYtemplate, BooleanValue, [], isTTYtemplateSrc);
    val.intrinsicName = isTTYtemplateSrc;
    return val;
  });
  // TODO: Implement the rest of this protocol.
  return obj;
}

function initializeSignalWrap(realm) {
  // TODO: Implement more of this protocol. When doing so, we'll likely need to
  // forward it to the native implementation.
  // let nativeSignalWrap = process.binding("signal_wrap");
  let obj = new ObjectValue(realm, realm.intrinsics.ObjectPrototype, "process.binding('signal_wrap')");

  let constructor = new NativeFunctionValue(
    realm,
    "process.binding('signal_wrap').Signal",
    "Signal",
    0,
    (context, args) => {
      return realm.intrinsics.undefined;
    }
  );
  Properties.OrdinaryDefineOwnProperty(realm, obj, "Signal", {
    value: constructor,
    writable: true,
    enumerable: true,
    configurable: true,
  });

  let SignalPrototype = new ObjectValue(
    realm,
    realm.intrinsics.ObjectPrototype,
    "process.binding('signal_wrap').Signal.prototype"
  );
  SignalPrototype.defineNativeMethod("unref", 0, (context, args) => {
    // TODO: Track the side-effect of this.
    return realm.intrinsics.undefined;
  });
  SignalPrototype.defineNativeMethod("start", 0, (context, args) => {
    // TODO: Track the side-effect of this.
    return realm.intrinsics.undefined;
  });
  SignalPrototype.defineNativeMethod("close", 0, (context, args) => {
    // TODO: Track the side-effect of this.
    return realm.intrinsics.undefined;
  });

  Properties.DefinePropertyOrThrow(realm, constructor, "prototype", {
    value: SignalPrototype,
    writable: true,
    enumerable: false,
    configurable: false,
  });

  // TODO
  return obj;
}

function initializeStreamWrap(realm) {
  // let nativeStreamWrap = process.binding("stream_wrap");
  let obj = new ObjectValue(realm, realm.intrinsics.ObjectPrototype, "process.binding('stream_wrap')");

  let constructor = new NativeFunctionValue(
    realm,
    "process.binding('stream_wrap').WriteWrap",
    "WriteWrap",
    0,
    (context, args) => {
      return realm.intrinsics.undefined;
    }
  );
  Properties.OrdinaryDefineOwnProperty(realm, obj, "WriteWrap", {
    value: constructor,
    writable: true,
    enumerable: true,
    configurable: true,
  });

  let WriteWrapPrototype = new ObjectValue(
    realm,
    realm.intrinsics.ObjectPrototype,
    "process.binding('stream_wrap').WriteWrap.prototype"
  );
  WriteWrapPrototype.defineNativeMethod("unref", 0, (context, args) => {
    // TODO: Track the side-effect of this.
    return realm.intrinsics.undefined;
  });

  Properties.DefinePropertyOrThrow(realm, constructor, "prototype", {
    value: WriteWrapPrototype,
    writable: true,
    enumerable: false,
    configurable: false,
  });

  let ShutdownWrap = createAbstractValue(realm, FunctionValue, "process.binding('stream_wrap').ShutdownWrap");
  Properties.DefinePropertyOrThrow(realm, obj, "ShutdownWrap", {
    value: ShutdownWrap,
    writable: true,
    configurable: true,
    enumerable: true,
  });

  // TODO
  return obj;
}

function initializeFSEvent(realm) {
  let obj = new ObjectValue(realm, realm.intrinsics.ObjectPrototype, "process.binding('fs_event_wrap')");
  let FSEvent = createAbstractValue(realm, FunctionValue, "process.binding('fs_event_wrap').FSEvent");
  Properties.DefinePropertyOrThrow(realm, obj, "FSEvent", {
    value: FSEvent,
    writable: true,
    configurable: true,
    enumerable: true,
  });

  // TODO
  return obj;
}

function initializeURL(realm) {
  let obj = new ObjectValue(realm, realm.intrinsics.ObjectPrototype);
  // TODO
  return obj;
}

function initializeUtil(realm) {
  let obj = new ObjectValue(realm, realm.intrinsics.ObjectPrototype, 'process.binding("util")');
  obj.defineNativeMethod("isUint8Array", 0, (context, args) => {
    let arr = args[0];
    if (arr instanceof ObjectValue && arr.$TypedArrayName === "Uint8Array") {
      return realm.intrinsics.true;
    }
    return realm.intrinsics.false;
  });
  copyProperty(
    realm,
    process.binding("util"),
    obj,
    "pushValToArrayMax",
    new NumberValue(realm, process.binding("util").pushValToArrayMax, 'process.binding("util").pushValToArrayMax')
  );
  // TODO
  return obj;
}

function createAbstractValue(realm, type, intrinsicName): AbstractObjectValue {
  let template = buildExpressionTemplate(intrinsicName);
  let val = AbstractValue.createFromTemplate(realm, template, ObjectValue, [], intrinsicName);
  val.values = new ValuesDomain(new Set([new ObjectValue(realm)]));
  val.intrinsicName = intrinsicName;
  return (val: any);
}

function createIntrinsicArrayValue(realm, intrinsicName) {
  // Like ArrayCreate but accepts an intrinsic name.
  let obj = new ArrayValue(realm, intrinsicName);
  obj.setExtensible(true);
  Properties.OrdinaryDefineOwnProperty(realm, obj, "length", {
    value: realm.intrinsics.zero,
    writable: true,
    enumerable: false,
    configurable: false,
  });
  return obj;
}

function reverseConfigJSON(config) {
  // Hack to restore the gyp config format
  let json = JSON.stringify(process.config).replace(/"/g, "'");
  return "\n" + json;
}

import {
  PropertyKeyValue,
} from "../../types.js";

class WetObjectValue extends ObjectValue {
  constructor(realm: Realm, hostBinding: string) {
    super(realm);
  }
  $Get(P: PropertyKeyValue, Receiver: Value): Value {
    global[hostBinding]
  }
}
export default function(realm: Realm, processArgv: Array<string>): ObjectValue {
  return {};
}
