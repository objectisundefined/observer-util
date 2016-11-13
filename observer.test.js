'use strict'

const expect = require('chai').expect
const observer = require('./observer')

describe('nx-observe', () => {
  describe('observable', () => {
    it('should return an observable wrapping the object argument', () => {
      const obj = {prop: 'value'}
      const observable = observer.observable(obj)
      expect(observable).to.not.equal(obj)
      expect(observer.isObservable(observable)).to.be.true
    })

    it('should return the argument if its an observable', () => {
      const observable1 = observer.observable()
      const observable2 = observer.observable(observable1)
      expect(observable1).to.equal(observable2)
    })

    it('should return the same proxy for repeated calls with the same argument', () => {
      const obj = {prop: 'value'}
      const observable1 = observer.observable(obj)
      const observable2 = observer.observable(obj)
      expect(observable1).to.equal(observable2)
    })

    it('should throw TypeError on invalid arguments', () => {
      expect(() => observer.observable(12)).to.throw(TypeError)
      expect(() => observer.observable('string')).to.throw(TypeError)
    })
  })

  describe('isObservable', () => {
    it('should return true if an observable is passed as argument', () => {
      const observable = observer.observable()
      const isObservable = observer.isObservable(observable)
      expect(isObservable).to.be.true
    })

    it('should return false if a non observable is passed as argument', () => {
      const obj1 = {prop: 'value'}
      const obj2 = new Proxy({}, {})
      const isObservable1 = observer.isObservable(obj1)
      const isObservable2 = observer.isObservable(obj2)
      expect(isObservable1).to.be.false
      expect(isObservable2).to.be.false
    })

    it('should throw TypeError on invalid arguments', () => {
      expect(() => observer.isObservable(12)).to.throw(TypeError)
      expect(() => observer.isObservable('string')).to.throw(TypeError)
      expect(() => observer.isObservable()).to.throw(TypeError)
    })
  })

  describe('observe', () => {
    it('should observe basic properties', () => {
      let dummy
      const observable = observer.observable({counter: 0})
      observer.observe(() => dummy = observable.counter)

      return Promise.resolve()
        .then(() => observable.counter = 2)
        .then(() => expect(dummy).to.equal(2))
        .then(() => observable.counter = undefined)
        .then(() => expect(dummy).to.equal(undefined))
    })

    it('should observe nested properties', () => {
      let dummy
      const observable = observer.observable({nested: {counter: 0}})
      observer.observe(() => dummy = observable.nested.counter)

      return Promise.resolve()
        .then(() => observable.nested.counter = 2)
        .then(() => expect(dummy).to.equal(2))
        .then(() => observable.nested.counter = 'invalid')
        .then(() => expect(dummy).to.equal('invalid'))
    })

    it('should observe properties on the prototype chain', () => {
      let dummy
      const observable = observer.observable({counter: 0})
      const parentObservable = observer.observable({parentCounter: 2})
      Object.setPrototypeOf(observable, parentObservable)
      observer.observe(() => dummy = observable.counter + observable.parentCounter)

      return Promise.resolve()
        .then(() => observable.counter = 2)
        .then(() => expect(dummy).to.equal(4))
        .then(() => parentObservable.parentCounter = 3)
        .then(() => expect(dummy).to.equal(5))
    })

    it('should observe delete operations', () => {
      let dummy
      const observable = observer.observable({counter: 0})
      observer.observe(() => dummy = observable.counter)

      return Promise.resolve()
        .then(() => delete observable.counter)
        .then(() => expect(dummy).to.equal(undefined))
    })

    it('should not observe set operations without value change', () => {
      let dummy
      const observable = observer.observable({counter: 0})

      let numOfRuns = 0
      function test () {
        dummy = observable.counter
        numOfRuns++
      }
      observer.observe(test)

      return Promise.resolve()
        .then(() => observable.counter = 0)
        .then(() => observable.counter = 0)
        .then(() => expect(numOfRuns).to.equal(1))
    })

    it('should observe function call chains', () => {
      let dummy
      const observable = observer.observable({counter: 0})
      observer.observe(() => dummy = getCounter())

      function getCounter () {
        return observable.counter
      }

      return Promise.resolve()
        .then(() => observable.counter = 2)
        .then(() => expect(dummy).to.equal(2))
    })

    it('should observe implicit properties (iteration, etc)', () => {
      let dummy
      const observable = observer.observable({array: ['Hello']})
      observer.observe(() => dummy = observable.array.join(' '))

      function getCounter () {
        return observable.counter
      }

      return Promise.resolve()
        .then(() => observable.array.push('World!'))
        .then(() => expect(dummy).to.equal('Hello World!'))
        .then(() => observable.array.shift())
        .then(() => expect(dummy).to.equal('World!'))
    })

    it('should run once (asynchronously) after the defining stack empties', () => {
      let dummy
      const observable = observer.observable({prop1: 'value1', prop2: 'value2'})

      let numOfRuns = 0
      function test () {
        dummy = observable.prop1 + observable.prop2
        numOfRuns++
      }
      observer.observe(test)
      expect(numOfRuns).to.equal(0)

      return Promise.resolve()
        .then(() => expect(numOfRuns).to.equal(1))
    })

    it('should rerun maximum once per stack', () => {
      let dummy
      const observable = observer.observable({prop1: 'value1', prop2: 'value2'})

      let numOfRuns = 0
      function test () {
        dummy = observable.prop1 + observable.prop2
        numOfRuns++
      }
      observer.observe(test)

      return Promise.resolve()
        .then(() => {
          observable.prop1 = 1
          observable.prop2 = 3
          observable.prop1 = 0
        })
        .then(() => expect(numOfRuns).to.equal(2))
    })

    it('should avoid infinite loops', () => {
      const observable1 = observer.observable({prop: 'value1'})
      const observable2 = observer.observable({prop: 'value2'})

      let numOfRuns1 = 0
      let numOfRuns2 = 0
      function test1 () {
        observable1.prop = observable2.prop
        numOfRuns1++
      }
      function test2 () {
        observable2.prop = observable1.prop
        numOfRuns2++
      }
      observer.observe(test1)
      observer.observe(test2)

      return Promise.resolve()
        .then(() => observable1.prop = 'Hello')
        .then(() => expect(observable2.prop).to.equal('Hello'))
        .then(() => observable2.prop = 'World!')
        .then(() => expect(observable1.prop).to.equal('World!'))
        .then(() => {
          expect(numOfRuns1).to.equal(3)
          expect(numOfRuns2).to.equal(3)
        })
    })

    it('should throw TypeError on invalid arguments', () => {
      expect(() => observer.observe(12)).to.throw(TypeError)
      expect(() => observer.observe({})).to.throw(TypeError)
      expect(() => observer.observe()).to.throw(TypeError)
    })
  })

  describe('unobserve', () => {
    it('should unobserve the observed function', () => {
      let dummy
      const observable = observer.observable({prop: 0})

      let numOfRuns = 0
      function test() {
        dummy = observable.prop
        numOfRuns++
      }
      observer.observe(test)

      return Promise.resolve()
        .then(() => observable.prop = 'Hello')
        .then(() => observer.unobserve(test))
        .then(() => observable.prop = 'World')
        .then(() => observable.prop = '!')
        .then(() => expect(numOfRuns).to.equal(2))
    })

    it('should unobserve even if the function is registered for the stack', () => {
      let dummy
      const observable = observer.observable({prop: 0})

      let numOfRuns = 0
      function test() {
        dummy = observable.prop
        numOfRuns++
      }
      observer.observe(test)
      observer.unobserve(test)

      return Promise.resolve()
        .then(() => expect(numOfRuns).to.equal(0))
    })

    it('should throw TypeError on invalid arguments', () => {
      expect(() => observer.unobserve(12)).to.throw(TypeError)
      expect(() => observer.unobserve({})).to.throw(TypeError)
      expect(() => observer.unobserve()).to.throw(TypeError)
    })
  })
})
