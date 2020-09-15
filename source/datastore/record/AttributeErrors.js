import { Class, meta } from '../../core/Core.js';
import Obj from '../../foundation/Object.js';
import '../../foundation/Decorators.js';

import { RecordAttribute } from './attr.js';

/**
    Class: O.AttributeErrors

    Extends: O.Object

    Maintains the state of the validity of each attribute on a record.
*/
const AttributeErrors = Class({
    Extends: Obj,

    /**
        Property: O.AttributeErrors#errorCount
        Type: Number

        The number of attributes on the record in an error state.
    */

    /**
        Constructor: O.AttributeErrors

        Parameters:
            record - {O.Record} The record to manage attribute errors for.
    */
    init: function (record) {
        AttributeErrors.parent.constructor.call(this);

        const attrs = meta(record).attrs;
        let errorCount = 0;

        for (const attrKey in attrs) {
            // Check if attribute has been removed (e.g. in a subclass).
            const propKey = attrs[attrKey];
            if (propKey) {
                // Validate current value and set error on this object.
                const attribute = record[propKey];
                const error = (this[propKey] = attribute.validate
                    ? attribute.validate(record.get(propKey), propKey, record)
                    : null);

                // Keep an error count
                if (error) {
                    errorCount += 1;
                }
            }
        }

        this.errorCount = errorCount;
        this._record = record;
    },

    /**
        Method: O.AttributeErrors#recordPropertyDidChange

        Called when a property changes which affects the validation
        of an attribute.

        Parameters:
            _    - {*} Unused.
            property - {String} The name of the property which has changed.
    */
    recordPropertyDidChange(_, property) {
        const metadata = meta(this);
        const changed = (metadata.changed = {});
        const dependents = metadata.dependents[property];
        const l = dependents ? dependents.length : 0;
        const record = this._record;

        this.beginPropertyChanges();
        for (let i = 0; i <= l; i += 1) {
            const propKey = i === l ? property : dependents[i];
            const attribute = record[propKey];
            if (changed[propKey] || !(attribute instanceof RecordAttribute)) {
                continue;
            }
            changed[propKey] = {
                oldValue: this[propKey],
                newValue: (this[propKey] = attribute.validate
                    ? attribute.validate(record.get(propKey), propKey, record)
                    : null),
            };
        }
        this.endPropertyChanges();
    },

    /**
        Method: O.AttributeErrors#setRecordValidity

        Updates the internal count of how many attributes are invalid and sets
        the <O.Record#isValid> property. Called automatically whenever a
        validity error string changes.

        Parameters:
            _       - {*} Unused.
            changed - {Object} A map of validity string changes.
    */
    setRecordValidity: function (_, changed) {
        let errorCount = this.get('errorCount');
        for (const key in changed) {
            if (key !== 'errorCount') {
                const vals = changed[key];
                const wasValid = !vals.oldValue;
                const isValid = !vals.newValue;
                if (wasValid && !isValid) {
                    errorCount += 1;
                } else if (isValid && !wasValid) {
                    errorCount -= 1;
                }
            }
        }
        this.set('errorCount', errorCount)._record.set('isValid', !errorCount);
    }.observes('*'),
});

export default AttributeErrors;
