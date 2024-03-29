/*global Element */

import { setBinding } from '../_codependent/_Binding.js';
import { getFromPath } from './getFromPath.js';
import { queueFn } from './RunLoop.js';

/**
    Class: O.Binding

    Includes: O.ComputedProps

    Bindings keep a property on one object in sync with a property on another.
    This may be a two way link, so a change on either updates the other, or it
    may only flow data in one direction. A transform may be applied to the data
    between instances.

    To use, create a new instance then call <O.Binding#from>, <O.Binding#to> and
    <O.Binding#connect>. Connection will normally be handled by the
    <O.BoundProps> class rather than directly.
*/

/**
    Method (private): O.Binding-_resolveRootAndPath

    When created, a binding may need to reference a path on an object that does
    not yet exist (it will be created later in the run loop). To allow this, a
    section of the path may be defined as 'static', that is to say it is
    resolved only once; at initialisation time. Any changes along this path;
    only changes starting from the final static object will be observed.

    A static portion is signified by using a `*` as a divider instead of a `.`.
    The section before the `*` is taken to be static. If no `*` is present, the
    entire path is taken to be dynamic. For example, if the path is
    `static.path*dynamic.path`, at initialisation time, the `path`
    property of the `static` property of the root object will be found. After
    initialisation, any changes to the 'dynamic' property on this object, or
    the 'path' property on that object will trigger the binding.

    The results are set directly on the binding object passed as the first
    argument, with names direction + 'Object'/'Path'.

    Parameters:
        binding   - {O.Binding} The binding to resolve paths for.
        direction - {String} Either 'to' or 'from'.
        root      - {Object} The object to treat as root.
        path      - {String} The path string.
*/
const _resolveRootAndPath = function (binding, direction, root, path) {
    const beginObservablePath = path.lastIndexOf('*') + 1;
    const observablePath = path.slice(beginObservablePath);
    const staticPath = beginObservablePath
        ? path.slice(0, beginObservablePath - 1)
        : '';
    const lastDot = observablePath.lastIndexOf('.');

    binding[direction + 'Object'] = staticPath
        ? getFromPath(root, staticPath)
        : root;
    binding[direction + 'Path'] = observablePath;
    binding[direction + 'PathBeforeKey'] =
        lastDot === -1 ? '' : observablePath.slice(0, lastDot);
    binding[direction + 'Key'] = observablePath.slice(lastDot + 1);
};

const isNum = /^\d+$/;

/**
    Method (private): O.Binding-identity

    Returns the first argument. This is the default transform (has no effect).

    Parameters:
        v - {*} The value.

    Returns:
        {*} The value v.
*/
const identity = (v) => v;

class Binding {
    __setupProperty__(metadata, key) {
        metadata.bindings[key] = this;
        metadata.inits.Bindings = (metadata.inits.Bindings || 0) + 1;
    }
    __teardownProperty__(metadata, key) {
        metadata.bindings[key] = null;
        metadata.inits.Bindings -= 1;
    }

    /**
        Property: O.Binding#isConnected
        Type: Boolean

        Is the instance currently observing for changes?
        This property is READ ONLY.
    */

    /**
        Property: O.Binding#isNotInSync
        Type: Boolean

        Has the data changed on the from object (or the 'to' object if two-way)?
        This property is READ ONLY.
    */

    /**
        Property: O.Binding#isSuspended
        Type: Boolean

        Should the binding stop propagating changes? This property is READ ONLY.
    */

    /**
        Property: O.Binding#willSyncForward
        Type: Boolean

        The direction to sync at the next sync. True if syncing from the 'from'
        object to the 'to' object, false if it's going to do the reverse.
    */

    /**
        Property: O.Binding#isTwoWay
        Type: Boolean
        Default: false

        Are changes just propagated from the 'from' object to the 'to' object,
        or are they also sent the other way?
    */

    /**
        Property: O.Binding#queue
        Type: String
        Default: 'bindings'

        During which queue in the run loop should the binding sync?
    */

    /**
        Constructor: O.Binding

        Parameters:
            mixin - {Object} (optional). Can set isTwoWay or the transform to
                    use on the binding.
    */
    constructor(mixin) {
        this.isConnected = false;
        this.isSuspended = true;
        this.isNotInSync = true;
        this.willSyncForward = true;

        // If the to or from object cannot be resolved, should the binding delay
        // the connection until the end of the run loop?
        this._doNotDelayConnection = false;

        this._fromPath = null;
        this._fromRoot = null;
        this._toPath = null;
        this._toRoot = null;

        this.fromObject = null;
        this.fromPath = '';
        this.fromPathBeforeKey = '';
        this.fromKey = '';

        this.toObject = null;
        this.toPath = '';
        this.toPathBeforeKey = '';
        this.toKey = '';

        this.isTwoWay = false;
        this.transform = identity;
        this.queue = 'bindings';

        Object.assign(this, mixin);
    }

    /**
        Method: O.Binding#destroy

        Disconnects binding and prevents any further value syncs.
    */
    destroy() {
        this.disconnect();
        // Ignore any remaining queued connect() calls.
        this.isConnected = true;
    }

    /**
        Method: O.Binding#from

        Sets the path and object to observe for changes. This method has no
        effect if it is called after the object is connected.

        Parameters:
            root - {Object} (optional) The object the static path is resolved
                   against, will be the "to" root if not supplied.
            path - {String} Any path before a *' is resolved at connection time
                   and then remains static. Path components after this are
                   treated as a dynamic path to watch for changes. If there is
                   no '*' present in the string, the entire string is taken as a
                   dynamic path.

        Returns:
            {O.Binding} Returns self.
    */
    from(root, path) {
        const rootIsPath = typeof root === 'string';
        this._fromRoot = rootIsPath ? path : root;
        this._fromPath = rootIsPath ? root : path;
        return this;
    }

    /**
        Method: O.Binding#to

        Sets the path and object to propagate changes to. This method has no
        effect if it is called after the object is connected.

        Parameters:
            root - {Object} (optional) The object the static path is resolved
                   against, will be the "from" root if not supplied.
            path - {String} Any path before a *' is resolved at connection time
                   and then remains static. Path components after this are
                   treated as a dynamic path to watch for changes. If there is
                   no '*' present in the string, the entire string is taken as a
                   dynamic path.

        Returns:
            {O.Binding} Returns self.
    */
    to(root, path) {
        const rootIsPath = typeof root === 'string';
        this._toRoot = rootIsPath ? path : root;
        this._toPath = rootIsPath ? root : path;
        return this;
    }

    // ------------

    /**
        Property: O.Binding#fromObject
        Type: Object

        The static object the observed path begins from.
    */

    /**
        Property: O.Binding#fromPath
        Type: String

        The dynamic path to observe on the from object.
    */

    /**
        Property: O.Binding#fromKey
        Type: String

        The final component of the fromPath (the property name on the final
        object).
    */

    /**
        Property: O.Binding#fromPathBeforeKey
        Type: String

        The dynamic 'from' path component before the final key.
    */

    /**
        Property: O.Binding#toObject
        Type: Object

        The static object from which the object-to-update path is resolved.
    */

    /**
        Property: O.Binding#toPath
        Type: String

        The dynamic path to follow on the to object.
    */

    /**
        Property: O.Binding#toKey
        Type: String

        The final component of the toPath (the property name on the final
        object).
    */

    /**
        Property: O.Binding#toPathBeforeKey
        Type: String

        The dynamic 'to' path component before the final key.
    */

    // ------------

    /**
        Method: O.Binding#connect

        Starts observing for changes and syncs the current value of the observed
        property on the from object with the bound property on the to object.

        Returns:
            {O.Binding} Returns self.
    */
    connect() {
        if (this.isConnected) {
            return this;
        }

        this.isSuspended = false;

        // Resolve objects:
        _resolveRootAndPath(
            this,
            'from',
            this._fromRoot || this._toRoot,
            this._fromPath,
        );
        _resolveRootAndPath(
            this,
            'to',
            this._toRoot || this._fromRoot,
            this._toPath,
        );

        const fromObject = this.fromObject;
        const toObject = this.toObject;

        if (toObject instanceof Element) {
            this.queue = 'render';
        }

        // Occassionally we have a binding created before the objects it
        // connects are, in which case delay connecting it a bit.
        if (!this._doNotDelayConnection && (!fromObject || !toObject)) {
            this._doNotDelayConnection = true;
            queueFn('before', this.connect, this);
            return this;
        }

        // This is a debugging aid; TypeErrors with messages like “x is null” or
        // “cannot read property 'addObserverForPath' of undefined” aren’t very
        // useful. The source line where the binding was defined is lost in the
        // mists of time (in debug mode I guess we *could* store a stack trace
        // in the constructor, but that’s a desperate measure), but the fromPath
        // is commonly useful in determining what went wrong.
        const fromPath = this.fromPath;
        if (!fromObject) {
            throw new TypeError(
                'Binding#connect: fromObject is not set' +
                    ' (fromPath = ' +
                    fromPath +
                    ')',
            );
        }
        fromObject.addObserverForPath(fromPath, this, 'fromDidChange');

        // Grab initial value:
        this.sync();

        if (this.isTwoWay) {
            toObject.addObserverForPath(this.toPath, this, 'toDidChange');
        }
        this.isConnected = true;
        return this;
    }

    /**
        Method: O.Binding#disconnect

        Stops observing for changes.

        Returns:
            {O.Binding} Returns self.
    */
    disconnect() {
        if (!this.isConnected) {
            return this;
        }

        this.fromObject.removeObserverForPath(
            this.fromPath,
            this,
            'fromDidChange',
        );

        if (this.isTwoWay) {
            this.toObject.removeObserverForPath(
                this.toPath,
                this,
                'toDidChange',
            );
        }

        this.isConnected = false;
        this.isSuspended = true;
        this.isNotInSync = true;
        this.willSyncForward = true;

        return this;
    }

    /**
        Method: O.Binding#suspend

        Stop propagating changes. The instance will still note when the observed
        object changes, but will not sync this to the bound property on the to
        object until the <O.Binding#resume> method is called.

        Returns:
            {O.Binding} Returns self.
    */
    suspend() {
        this.isSuspended = true;
        return this;
    }

    /**
        Method: O.Binding#resume

        Restart propagating changes. Sync the to object if the observed property
        has changed.

        Returns:
            {O.Binding} Returns self.
    */
    resume() {
        if (this.isSuspended && this.isConnected) {
            this.isSuspended = false;
            this.sync();
        }
        return this;
    }

    // ------------

    /**
        Property: O.Binding#transform
        Type: Function

        A function which is applied to a value coming from one object before it
        is set on the other object.
    */

    // ------------

    /**
        Method: O.Binding#fromDidChange

        Called when the observed property on the from object changes; adds the
        binding to the queue to be synced at the end of the run loop.

        Returns:
            {O.Binding} Returns self.
    */
    fromDidChange() {
        return this.needsSync(true);
    }

    /**
        Method: O.Binding#toDidChange

        If the binding is two-way, this is called when the observed property on
        the to object changes; adds the binding to the queue to be synced at the
        end of the run loop.

        Returns:
            {O.Binding} Returns self.
    */
    toDidChange() {
        return this.needsSync(false);
    }

    /**
        Method: O.Binding#needsSync

        Adds the binding to the queue to be synced at the end of the run loop.

        Parameters:
            direction - {Boolean} True if sync needed from the "from" object to
                        the "to" object, false if the reverse.

        Returns:
            {O.Binding} Returns self.
    */
    needsSync(direction) {
        const queue = this.queue;
        const inQueue = this.isNotInSync;
        this.willSyncForward = direction;
        this.isNotInSync = true;
        if (!inQueue && !this.isSuspended) {
            if (queue) {
                queueFn(queue, this.sync, this, true);
            } else {
                this.sync();
            }
        }
        return this;
    }

    /**
        Method: O.Binding#sync

        If the observed property has changed, this method applies any transforms
        and propagates the data to the other object.

        Parameters:
            force - {Boolean} If true, sync the binding even if it hasn't
                    changed.

        Returns:
            {Boolean} Did the binding actually make a change?
    */
    sync(force) {
        if (!force && (!this.isNotInSync || this.isSuspended)) {
            return false;
        }

        this.isNotInSync = false;

        const syncForward = this.willSyncForward;
        const from = syncForward ? 'from' : 'to';
        const to = syncForward ? 'to' : 'from';
        const pathBeforeKey = this[to + 'PathBeforeKey'];
        let toObject = this[to + 'Object'];

        if (pathBeforeKey) {
            toObject = toObject.getFromPath(pathBeforeKey);
        }
        if (!toObject) {
            return false;
        }

        const key = this[to + 'Key'];
        const value = this.transform(
            this[from + 'Object'].getFromPath(this[from + 'Path']),
            syncForward,
        );
        if (value !== undefined) {
            if (isNum.test(key)) {
                toObject.setObjectAt(+key, value);
            } else {
                toObject.set(key, value);
            }
        }
        return true;
    }
}

setBinding(Binding);

/**
    Function: O.bind

    Convenience method. A shortcut for:
        new O.Binding({
            transform: transform
        }).from( root, path );

    Parameters:
        root      - {Object} (optional) The root object on the path to bind
                    from. If not specified, will be the same object that the
                    property is bound to.
        path      - {String} The path to bind from
        transform - {Function} (optional) A transform to apply.

    Returns:
        {O.Binding} The new binding.
*/
const bind = function (root, path, transform) {
    const binding = new Binding().from(root, path);
    if (transform) {
        binding.transform = transform;
    }
    return binding;
};

/**
    Function: O.bindTwoWay

    Convenience method. A shortcut for:
        new O.Binding({
            isTwoWay: true,
            transform: transform
        }).from( root, path );

    Parameters:
        root      - {Object} (optional) The root object on the path to bind
                    from. If not specified, will be the same object that the
                    property is bound to.
        path      - {String} The path to bind from
        transform - {Function} (optional) A transform to apply.

    Returns:
        {O.Binding} The new binding.
*/
const bindTwoWay = function (root, path, transform) {
    const binding = bind(root, path, transform);
    binding.isTwoWay = true;
    return binding;
};

export { Binding, bind, bindTwoWay };
