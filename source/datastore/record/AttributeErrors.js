import { Class, meta } from '../../core/Core';
import Obj from '../../foundation/Object';
import '../../foundation/ObservableProps'; // For Function#observes

import { RecordAttribute } from './attr';

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
        let attrKey, propKey, attribute, error;

        for (attrKey in attrs) {
            // Check if attribute has been removed (e.g. in a subclass).
            if ((propKey = attrs[attrKey])) {
                // Validate current value and set error on this object.
                attribute = record[propKey];
                error = this[propKey] = attribute.validate
                    ? attribute.validate(record.get(propKey), propKey, record)
                    : null;

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
        let i, propKey, attribute;

        this.beginPropertyChanges();
        for (i = 0; i <= l; i += 1) {
            if (i === l) {
                propKey = property;
            } else {
                propKey = dependents[i];
            }
            attribute = record[propKey];
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
        let errorCount = this.get('errorCount'),
            key,
            vals,
            wasValid,
            isValid;
        for (key in changed) {
            if (key !== 'errorCount') {
                vals = changed[key];
                wasValid = !vals.oldValue;
                isValid = !vals.newValue;
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
