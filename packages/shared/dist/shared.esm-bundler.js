const isObject = value => typeof value === 'object' && value !== null;
const extend = Object.assign;
const isArray = Array.isArray;
const isFunction = value => typeof value === 'function';
const isNumber = value => typeof value === 'number';
const isString = value => typeof value === 'string';
const isIntegerKey = key => parseInt(key) + '' === key;
const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target, key);
const hasChanged = (oldVal, val) => oldVal !== val;

export { extend, hasChanged, hasOwn, isArray, isFunction, isIntegerKey, isNumber, isObject, isString };
//# sourceMappingURL=shared.esm-bundler.js.map
