import { proxyToRaw, rawToProxy } from './internals'
import { storeObservable } from './store'
// import * as builtIns from './builtIns'
// import baseHandlers from './handlers'

import {
  registerRunningReactionForOperation,
  queueReactionsForOperation,
  hasRunningReaction
} from './reactionRunner'
// import { proxyToRaw, rawToProxy } from '../internals'

const hasOwnProperty = Object.prototype.hasOwnProperty

function findObservable (obj) {
  const observableObj = rawToProxy.get(obj)
  if (hasRunningReaction() && typeof obj === 'object' && obj !== null) {
    if (observableObj) {
      return observableObj
    }
    return observable(obj)
  }
  return observableObj || obj
}

function patchIterator (iterator, isEntries) {
  const originalNext = iterator.next
  iterator.next = () => {
    let { done, value } = originalNext.call(iterator)
    if (!done) {
      if (isEntries) {
        value[1] = findObservable(value[1])
      } else {
        value = findObservable(value)
      }
    }
    return { done, value }
  }
  return iterator
}

const instrumentations = {
  has (key) {
    const target = proxyToRaw.get(this)
    const proto = Reflect.getPrototypeOf(this)
    registerRunningReactionForOperation({ target, key, type: 'has' })
    return proto.has.apply(target, arguments)
  },
  get (key) {
    const target = proxyToRaw.get(this)
    const proto = Reflect.getPrototypeOf(this)
    registerRunningReactionForOperation({ target, key, type: 'get' })
    return findObservable(proto.get.apply(target, arguments))
  },
  add (key) {
    const target = proxyToRaw.get(this)
    const proto = Reflect.getPrototypeOf(this)
    const hadKey = proto.has.call(target, key)
    // forward the operation before queueing reactions
    const result = proto.add.apply(target, arguments)
    if (!hadKey) {
      queueReactionsForOperation({ target, key, value: key, type: 'add' })
    }
    return result
  },
  set (key, value) {
    const target = proxyToRaw.get(this)
    const proto = Reflect.getPrototypeOf(this)
    const hadKey = proto.has.call(target, key)
    const oldValue = proto.get.call(target, key)
    // forward the operation before queueing reactions
    const result = proto.set.apply(target, arguments)
    if (!hadKey) {
      queueReactionsForOperation({ target, key, value, type: 'add' })
    } else if (value !== oldValue) {
      queueReactionsForOperation({ target, key, value, oldValue, type: 'set' })
    }
    return result
  },
  delete (key) {
    const target = proxyToRaw.get(this)
    const proto = Reflect.getPrototypeOf(this)
    const hadKey = proto.has.call(target, key)
    const oldValue = proto.get ? proto.get.call(target, key) : undefined
    // forward the operation before queueing reactions
    const result = proto.delete.apply(target, arguments)
    if (hadKey) {
      queueReactionsForOperation({ target, key, oldValue, type: 'delete' })
    }
    return result
  },
  clear () {
    const target = proxyToRaw.get(this)
    const proto = Reflect.getPrototypeOf(this)
    const hadItems = target.size !== 0
    const oldTarget = target instanceof Map ? new Map(target) : new Set(target)
    // forward the operation before queueing reactions
    const result = proto.clear.apply(target, arguments)
    if (hadItems) {
      queueReactionsForOperation({ target, oldTarget, type: 'clear' })
    }
    return result
  },
  forEach (cb, ...args) {
    const target = proxyToRaw.get(this)
    const proto = Reflect.getPrototypeOf(this)
    registerRunningReactionForOperation({ target, type: 'iterate' })
    // swap out the raw values with their observable pairs
    // before passing them to the callback
    const wrappedCb = (value, ...rest) => cb(findObservable(value), ...rest)
    return proto.forEach.call(target, wrappedCb, ...args)
  },
  keys () {
    const target = proxyToRaw.get(this)
    const proto = Reflect.getPrototypeOf(this)
    registerRunningReactionForOperation({ target, type: 'iterate' })
    return proto.keys.apply(target, arguments)
  },
  values () {
    const target = proxyToRaw.get(this)
    const proto = Reflect.getPrototypeOf(this)
    registerRunningReactionForOperation({ target, type: 'iterate' })
    const iterator = proto.values.apply(target, arguments)
    return patchIterator(iterator, false)
  },
  entries () {
    const target = proxyToRaw.get(this)
    const proto = Reflect.getPrototypeOf(this)
    registerRunningReactionForOperation({ target, type: 'iterate' })
    const iterator = proto.entries.apply(target, arguments)
    return patchIterator(iterator, true)
  },
  [Symbol.iterator] () {
    const target = proxyToRaw.get(this)
    const proto = Reflect.getPrototypeOf(this)
    registerRunningReactionForOperation({ target, type: 'iterate' })
    const iterator = proto[Symbol.iterator].apply(target, arguments)
    return patchIterator(iterator, target instanceof Map)
  },
  get size () {
    const target = proxyToRaw.get(this)
    const proto = Reflect.getPrototypeOf(this)
    registerRunningReactionForOperation({ target, type: 'iterate' })
    return Reflect.get(proto, 'size', target)
  }
}

/* export default */ const collectionHandlers = {
  get (target, key, receiver) {
    // instrument methods and property accessors to be reactive
    target = hasOwnProperty.call(instrumentations, key)
      ? instrumentations
      : target
    return Reflect.get(target, key, receiver)
  }
}

const globalObj =
  // eslint-disable-next-line
  typeof window === "object" ? window : Function("return this")();

// built-in object can not be wrapped by Proxies
// their methods expect the object instance as the 'this' instead of the Proxy wrapper
// complex objects are wrapped with a Proxy of instrumented methods
// which switch the proxy to the raw object and to add reactive wiring
const handlers = new Map([
  [Map, collectionHandlers],
  [Set, collectionHandlers],
  [WeakMap, collectionHandlers],
  [WeakSet, collectionHandlers],
  [Object, false],
  [Array, false],
  [Int8Array, false],
  [Uint8Array, false],
  [Uint8ClampedArray, false],
  [Int16Array, false],
  [Uint16Array, false],
  [Int32Array, false],
  [Uint32Array, false],
  [Float32Array, false],
  [Float64Array, false]
])

function shouldInstrument ({ constructor }) {
  const isBuiltIn =
    typeof constructor === 'function' &&
    constructor.name in globalObj &&
    globalObj[constructor.name] === constructor
  return !isBuiltIn || handlers.has(constructor)
}

function getHandlers (obj) {
  return handlers.get(obj.constructor)
}

const builtIns = { shouldInstrument, getHandlers }

/*
import {
  registerRunningReactionForOperation,
  queueReactionsForOperation,
  hasRunningReaction
} from './reactionRunner'
*/

// const hasOwnProperty = Object.prototype.hasOwnProperty
const wellKnownSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map(key => Symbol[key])
    .filter(value => typeof value === 'symbol')
)

// intercept get operations on observables to know which reaction uses their properties
function get (target, key, receiver) {
  const result = Reflect.get(target, key, receiver)
  // do not register (observable.prop -> reaction) pairs for well known symbols
  // these symbols are frequently retrieved in low level JavaScript under the hood
  if (typeof key === 'symbol' && wellKnownSymbols.has(key)) {
    return result
  }
  // register and save (observable.prop -> runningReaction)
  registerRunningReactionForOperation({ target, key, receiver, type: 'get' })
  // if we are inside a reaction and observable.prop is an object wrap it in an observable too
  // this is needed to intercept property access on that object too (dynamic observable tree)
  const observableResult = rawToProxy.get(result)
  if (hasRunningReaction() && typeof result === 'object' && result !== null) {
    if (observableResult) {
      return observableResult
    }
    // do not violate the none-configurable none-writable prop get handler invariant
    // fall back to none reactive mode in this case, instead of letting the Proxy throw a TypeError
    const descriptor = Reflect.getOwnPropertyDescriptor(target, key)
    if (
      !descriptor ||
      !(descriptor.writable === false && descriptor.configurable === false)
    ) {
      return observable(result)
    }
  }
  // otherwise return the observable wrapper if it is already created and cached or the raw object
  return observableResult || result
}

function has (target, key) {
  const result = Reflect.has(target, key)
  // register and save (observable.prop -> runningReaction)
  registerRunningReactionForOperation({ target, key, type: 'has' })
  return result
}

function ownKeys (target) {
  registerRunningReactionForOperation({ target, type: 'iterate' })
  return Reflect.ownKeys(target)
}

// intercept set operations on observables to know when to trigger reactions
function set (target, key, value, receiver) {
  // make sure to do not pollute the raw object with observables
  if (typeof value === 'object' && value !== null) {
    value = proxyToRaw.get(value) || value
  }
  // save if the object had a descriptor for this key
  const hadKey = hasOwnProperty.call(target, key)
  // save if the value changed because of this set operation
  const oldValue = target[key]
  // execute the set operation before running any reaction
  const result = Reflect.set(target, key, value, receiver)
  // do not queue reactions if the target of the operation is not the raw receiver
  // (possible because of prototypal inheritance)
  if (target !== proxyToRaw.get(receiver)) {
    return result
  }
  // queue a reaction if it's a new property or its value changed
  if (!hadKey) {
    queueReactionsForOperation({ target, key, value, receiver, type: 'add' })
  } else if (value !== oldValue) {
    queueReactionsForOperation({
      target,
      key,
      value,
      oldValue,
      receiver,
      type: 'set'
    })
  }
  return result
}

function deleteProperty (target, key) {
  // save if the object had the key
  const hadKey = hasOwnProperty.call(target, key)
  const oldValue = target[key]
  // execute the delete operation before running any reaction
  const result = Reflect.deleteProperty(target, key)
  // only queue reactions for delete operations which resulted in an actual change
  if (hadKey) {
    queueReactionsForOperation({ target, key, oldValue, type: 'delete' })
  }
  return result
}

/* export default */ const baseHandlers = {
  get,
  has,
  ownKeys,
  set,
  deleteProperty
}

export function observable (obj = {}) {
  // if it is already an observable or it should not be wrapped, return it
  if (proxyToRaw.has(obj) || !builtIns.shouldInstrument(obj)) {
    return obj
  }
  // if it already has a cached observable wrapper, return it
  // otherwise create a new observable
  return rawToProxy.get(obj) || createObservable(obj)
}

function createObservable (obj) {
  // if it is a complex built-in object or a normal object, wrap it
  const handlers = builtIns.getHandlers(obj) || baseHandlers
  const observable = new Proxy(obj, handlers)
  // save these to switch between the raw object and the wrapped object with ease later
  rawToProxy.set(obj, observable)
  proxyToRaw.set(observable, obj)
  // init basic data structures to save and cleanup later (observable.prop -> reaction) connections
  storeObservable(obj)
  return observable
}

export function isObservable (obj) {
  return proxyToRaw.has(obj)
}

export function raw (obj) {
  return proxyToRaw.get(obj) || obj
}
