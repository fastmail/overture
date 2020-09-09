import { clone } from '../core/Core.js';
import { _eventPrefix as eventPrefix } from './EventTarget.js';
import {
    queueFn,
    invoke,
    invokeInNextEventLoop,
    invokeInNextFrame,
} from './RunLoop.js';

const slice = Array.prototype.slice;

const makeComputedDidChange = function (key) {
    return function () {
        this.computedPropertyDidChange(key);
    };
};

const setupComputed = function (metadata, key, object) {
    const dependencies = this.dependencies;
    let dependents = metadata.dependents;

    if (!metadata.hasOwnProperty('dependents')) {
        dependents = metadata.dependents = clone(dependents);
        metadata.allDependents = {};
    }
    let l = dependencies.length;
    let method;
    let pathObservers;
    let methodObservers;
    while (l--) {
        const valueThisKeyDependsOn = dependencies[l];
        if (valueThisKeyDependsOn.indexOf('.') === -1) {
            (
                dependents[valueThisKeyDependsOn] ||
                (dependents[valueThisKeyDependsOn] = [])
            ).push(key);
        } else {
            if (!method) {
                method = '__' + key + 'DidChange__';
                metadata.inits.Observers = (metadata.inits.Observers || 0) + 1;
            }
            if (!object[method]) {
                object[method] = makeComputedDidChange(key);
            }
            if (!pathObservers) {
                pathObservers = metadata.pathObservers;
                if (!metadata.hasOwnProperty('pathObservers')) {
                    pathObservers = metadata.pathObservers = Object.create(
                        pathObservers,
                    );
                }
                methodObservers = pathObservers[method];
                if (!methodObservers) {
                    methodObservers = pathObservers[method] = [];
                } else if (!pathObservers.hasOwnProperty(method)) {
                    methodObservers = pathObservers[
                        method
                    ] = methodObservers.slice();
                }
            }
            methodObservers.push(valueThisKeyDependsOn);
        }
    }
};

const teardownComputed = function (metadata, key) {
    const dependencies = this.dependencies;
    let dependents = metadata.dependents;

    if (!metadata.hasOwnProperty('dependents')) {
        dependents = metadata.dependents = clone(dependents);
        metadata.allDependents = {};
    }
    let l = dependencies.length;
    let method;
    let pathObservers;
    let methodObservers;
    while (l--) {
        const valueThisKeyDependsOn = dependencies[l];
        if (valueThisKeyDependsOn.indexOf('.') === -1) {
            dependents[valueThisKeyDependsOn].erase(key);
        } else {
            if (!method) {
                method = '__' + key + 'DidChange__';
                metadata.inits.Observers -= 1;
            }
            if (!pathObservers) {
                pathObservers = metadata.pathObservers;
                if (!metadata.hasOwnProperty('pathObservers')) {
                    pathObservers = metadata.pathObservers = Object.create(
                        pathObservers,
                    );
                }
                methodObservers = pathObservers[method];
                if (!pathObservers.hasOwnProperty(method)) {
                    methodObservers = pathObservers[
                        method
                    ] = methodObservers.slice();
                }
            }
            methodObservers.erase(valueThisKeyDependsOn);
        }
    }
};

const setupObserver = function (metadata, method) {
    const observes = this.observedProperties;
    let l = observes.length;
    let pathObservers;

    while (l--) {
        const key = observes[l];
        if (key.indexOf('.') === -1) {
            metadata.addObserver(key, { object: null, method });
        } else {
            if (!pathObservers) {
                pathObservers = metadata.pathObservers;
                if (!metadata.hasOwnProperty('pathObservers')) {
                    pathObservers = metadata.pathObservers = Object.create(
                        pathObservers,
                    );
                }
                // There can't be any existing path observers for this method,
                // as we're only just adding it (and if we're overriding a
                // previous method, we should have removed all of their path
                // observers first anyway).
                pathObservers = pathObservers[method] = [];
                metadata.inits.Observers = (metadata.inits.Observers || 0) + 1;
            }
            pathObservers.push(key);
        }
    }
};

const teardownObserver = function (metadata, method) {
    const observes = this.observedProperties;
    let l = observes.length;
    let pathObservers;

    while (l--) {
        const key = observes[l];
        if (key.indexOf('.') === -1) {
            metadata.removeObserver(key, { object: null, method });
        } else if (!pathObservers) {
            pathObservers = metadata.pathObservers;
            if (!metadata.hasOwnProperty('pathObservers')) {
                pathObservers = metadata.pathObservers = Object.create(
                    pathObservers,
                );
            }
            // We want to remove all path observers. Can't just delete though,
            // as it may be defined on the prototype object.
            pathObservers[method] = null;
            metadata.inits.Observers -= 1;
        }
    }
};

Object.assign(Function.prototype, {
    /**
        Method: Function#property

        Marks a function as a property getter/setter. If a call to
        <O.ComputedProps#get> or <O.ComputedProps#set> is made and the
        current value of the property is this method, the method will be called
        rather than just returned/overwritten itself.

        Normally, properties will only be dependent on other properties on the
        same object. You may also specify paths though, e.g. `object.obj2.prop`
        and this will also work, however if you do this the object (and all
        other objects in the path) *MUST* also include the <O.ObservableProps>
        mixin.

        Parameters:
            var_args - {...String} All arguments are treated as the names of
                       properties this value depends on; if any of these are
                       changed, the cached value for this property will be
                       invalidated.

        Returns:
            {Function} Returns self.
    */
    property() {
        this.isProperty = true;
        if (arguments.length) {
            this.dependencies = slice.call(arguments);
            this.__setupProperty__ = setupComputed;
            this.__teardownProperty__ = teardownComputed;
        }
        return this;
    },

    /**
        Method: Function#nocache

        Marks a getter method such that its value is not cached.

        Returns:
            {Function} Returns self.
    */
    nocache() {
        this.isVolatile = true;
        return this;
    },

    /**
        Method: Function#doNotNotify

        Marks a computed property so that when it is set,
        <O.ComputedProps#propertyDidChange> is not automatically called.

        Returns:
            {Function} Returns self.
    */
    doNotNotify() {
        this.isSilent = true;
        return this;
    },

    /**
        Method: Function#observes

        Defines the list of properties (on the same object) or paths (relative
        to this object) that this method is interested in. Whenever one of these
        properties changes, the method will automatically be called.

        Parameters:
            var_args - {...String} All arguments are treated as the names of
                    properties this method should observe.

        Returns:
            {Function} Returns self.
    */
    observes() {
        const properties =
            this.observedProperties || (this.observedProperties = []);
        let l = arguments.length;
        while (l--) {
            properties.push(arguments[l]);
        }
        this.__setupProperty__ = setupObserver;
        this.__teardownProperty__ = teardownObserver;
        return this;
    },

    /**
        Method: Function#on

        Defines the list of events this method is interested in. Whenever one of
        these events is triggered on the object to which this method belongs,
        the method will automatically be called.

        Parameters:
            var_args - {...String} All arguments are treated as the names of
                    events this method should be triggered by.

        Returns:
            {Function} Returns self.
    */
    on() {
        return this.observes.apply(
            this,
            slice.call(arguments).map((type) => {
                return eventPrefix + type;
            }),
        );
    },

    /**
        Method: Function#queue

        Parameters:
            queue - {String} The name of the queue to add calls to this function
                    to.

        Returns:
            {Function} Returns wrapper that passes calls to
            <O.RunLoop.queueFn>.
    */
    queue(queue) {
        const fn = this;
        return function () {
            queueFn(queue, fn, this);
            return this;
        };
    },

    /**
        Method: Function#nextLoop

        Returns:
            {Function} Returns wrapper that passes calls to
            <O.RunLoop.invokeInNextEventLoop>.
    */
    nextLoop() {
        const fn = this;
        return function () {
            invokeInNextEventLoop(fn, this);
            return this;
        };
    },

    /**
        Method: Function#nextFrame

        Returns:
            {Function} Returns wrapper that passes calls to
            <O.RunLoop.invokeInNextFrame>.
    */
    nextFrame() {
        const fn = this;
        return function () {
            invokeInNextFrame(fn, this);
            return this;
        };
    },

    /**
        Method: Function#invokeInRunLoop

        Wraps any calls to this function inside a call to <O.RunLoop.invoke>.

        Returns:
            {Function} Returns wrapped function.
    */
    invokeInRunLoop() {
        const fn = this;
        return function () {
            return invoke(fn, this, arguments);
        };
    },
});
