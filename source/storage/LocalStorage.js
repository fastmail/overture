import { Class, isEqual } from '../core/Core';
import Obj from '../foundation/Object';

/**
    Module: Storage

    The Storage module provides classes for persistant storage in the client.
*/

const dummyStorage = {
    setItem() {},
    getItem() {},
};

/**
    Class: O.LocalStorage

    Extends: O.Object

    LocalStorage provides an observable object interface to the local/session
    storage facilities provided by modern browsers. Essentially, you can treat
    it as an instance of <O.Object> whose values persists between page reloads
    (and between browser sessions if not set to session-only).

    Since data is serialised to a string for storage, only native JS types
    should be stored; class instances will not be restored correctly.
*/
const LocalStorage = Class({
    Extends: Obj,

    /**
        Constructor: O.LocalStorage

        Parameters:
            name        - {String} The name of this storage set. Objects with
                          the same name will overwrite each others' values.
            sessionOnly - {Boolean} (optional) Should the values only be
                          persisted for the session?
    */
    init: function (name, sessionOnly, defaults) {
        this._name = name + '.';
        this._store =
            location.protocol === 'file:'
                ? dummyStorage
                : sessionOnly
                ? sessionStorage
                : localStorage;
        this._defaults = defaults || {};

        LocalStorage.parent.constructor.call(this);
    },

    setName(name) {
        this._name = name + '.';
        const keys = Object.keys(this).filter(
            (key) => this.hasOwnProperty(key) && key.charAt(0) !== '_',
        );
        this.beginPropertyChanges();
        keys.forEach((key) => {
            const oldValue = this[key];
            delete this[key];
            const newValue = this.get(key);
            if (!isEqual(oldValue, newValue)) {
                this.propertyDidChange(key, oldValue, newValue);
            }
        });
        return this.endPropertyChanges();
    },

    get(key) {
        if (!(key in this)) {
            const defaults = this._defaults;
            let item;
            // An error may be thrown if no permission, e.g. in private
            // browsing
            try {
                item = this._store.getItem(this._name + key);
            } catch (error) {}
            const value = item ? JSON.parse(item) : defaults[key];
            this[key] = value;
            return value;
        }
        return LocalStorage.parent.get.call(this, key);
    },

    set(key, value) {
        // If we exceed the storage quota, an error will be thrown.
        try {
            this._store.setItem(this._name + key, JSON.stringify(value));
        } catch (error) {}
        return LocalStorage.parent.set.call(this, key, value);
    },
});

export default LocalStorage;
