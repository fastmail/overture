/*global window */

/**
 This file imports all the parts of Overture that affect the global environment.
*/
import './core/Array.js';
import './core/Date.js';
import './core/String.js';
import './foundation/Decorators.js';
import './dom/Element.js';
import './localisation/RelativeDate.js';

// Replace the global Promise with our RunLoop-enabled Promise
window.Promise = Promise;
