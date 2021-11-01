const isObject = value => typeof value === 'object' && value !== null;
const extend = Object.assign;
const isArray = Array.isArray;
const isFunction = value => typeof value === 'function';
const isIntegerKey = key => parseInt(key) + '' === key;
const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target, key);
const hasChanged = (oldVal, val) => oldVal !== val;

var TrackOpTypes;
(function (TrackOpTypes) {
    TrackOpTypes[TrackOpTypes["GET"] = 0] = "GET";
})(TrackOpTypes || (TrackOpTypes = {}));
var TriggerOrTypes;
(function (TriggerOrTypes) {
    TriggerOrTypes[TriggerOrTypes["ADD"] = 0] = "ADD";
    TriggerOrTypes[TriggerOrTypes["SET"] = 1] = "SET";
})(TriggerOrTypes || (TriggerOrTypes = {}));

function effect(fn, options = {}) {
    // 
    const effect = createReactiveEffect(fn, options);
    if (!options.lazy) {
        effect(); // 默认会执行一次
    }
    return effect;
}
let uid = 0;
let activeEffect;
let effectStack = [];
function createReactiveEffect(fn, options) {
    const effect = function reactiveEffect() {
        if (effectStack.includes(effect))
            return;
        // 这里之所以使用 try 是因为 fn 执行的过程可能报错，但是无论是否报错，我们都要重新维护 effectStack 和 activeEffect
        try {
            effectStack.push(effect);
            activeEffect = effect;
            console.log('activeEffect', activeEffect);
            fn();
        }
        finally {
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1];
        }
    };
    effect.id = uid++; // 每一个 effect 都有一个唯一的标识
    effect._isEffect = true; // 标识是响应式的 effect
    effect.raw = fn; // 记录 effect 的原始函数
    effect.options = options;
    return effect;
}
// 将 activeEffect 与 target[key] 关联起来，当 target[key] 值改变时，执行activeEffect
const targetMap = new WeakMap;
function track(target, type, key) {
    console.log(target, type, key, activeEffect);
    if (activeEffect === undefined)
        return;
    if (!targetMap.has(target)) {
        targetMap.set(target, new Map);
    }
    let depsMap = targetMap.get(target);
    if (!depsMap.has(key)) {
        depsMap.set(key, new Set);
    }
    let dep = depsMap.get(key);
    if (!dep.has(activeEffect)) {
        dep.add(activeEffect);
    }
    // console.log(targetMap)
}
// 根据已经关联的 activeEffect 与 target[key]，执行对应的 activeEffect 来更新视图
// activeEffect 存储的就是更新视图的操作
function trigger(target, type, key, newValue, oldValue) {
    console.log(target, type, key, newValue, oldValue, targetMap);
    if (!targetMap.has(target))
        return;
    const depsMap = targetMap.get(target);
    // console.log('depsMap', depsMap)
    const effects = new Set; // 可以去重 effect
    const add = effectsAdd => {
        if (effectsAdd) {
            effectsAdd.forEach(effect => effects.add(effect));
        }
    };
    // 如果修改的是数组的length
    if (isArray(target) && key === 'length') {
        depsMap.forEach((dep, k) => {
            if (k === 'length' || k >= newValue) {
                add(dep);
            }
        });
    }
    else {
        // 如果是对象
        if (key !== undefined) {
            add(depsMap.get(key));
        }
        // 如果修改的是数组的某个索引，那就把数组长度的effect收集起来
        switch (type) {
            case TriggerOrTypes.ADD:
                if (isArray(target) && isIntegerKey(key)) {
                    add(depsMap.get('length'));
                }
        }
    }
    // console.log(effects)
    effects.forEach((effect) => {
        // computed 里面访问的数据，这个数据在收集依赖的时候因为 computed 里访问了它，所以 computed 也会被该数据收集
        // 当 computed 里依赖的数据发生改变了，它会执行它收集的 effect 的，这个时候 computed effect 也被执行了，所以 scheduler 执行了，computed effect 的 _dirty 置为 false 了
        if (effect.options.scheduler) {
            effect.options.scheduler(effect);
        }
        else {
            effect();
        }
    });
}

function createGetter(isReadonly = false, isShallow = false) {
    return function get(target, key, receiver) {
        const res = Reflect.get(target, key, receiver);
        if (!isReadonly) {
            // 收集依赖，数据变化后更新视图
            track(target, TrackOpTypes.GET, key);
        }
        if (isShallow) {
            return res;
        }
        // Vue3是懒代理，取值的时候才会去代理深层对象(Vue2是直接深度递归代理)
        if (isObject(res)) {
            return isReadonly ? readonly(res) : reactive(res);
        }
        return res;
    };
}
const get = createGetter();
const shallowReactiveGet = createGetter(false, true);
const readonlyGet = createGetter(true, false);
const shallowReadonlyGet = createGetter(true, true);
function createSetter(isShallow = false) {
    return function set(target, key, value, receiver) {
        const oldValue = target[key]; // 获取旧的值
        // 如果是数组，判断修改的索引是否小于数组的长度
        // 如果是对象，判断对象是否之前就有该属性
        const hasKey = isArray(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn(target, key);
        const result = Reflect.set(target, key, value, receiver);
        // 当数据更新时，通知对应属性的effect执行
        if (!hasKey) {
            // 新增的属性
            trigger(target, TriggerOrTypes.ADD, key, value);
        }
        else if (hasChanged(oldValue, value)) {
            // 修改属性的值
            trigger(target, TriggerOrTypes.SET, key, value, oldValue);
        }
        return result;
    };
}
const set = createSetter();
const shallowReactiveSet = createSetter(true);
const readonlyObj = {
    set: (target, key) => {
        console.warn(`cannot set key ${key} is readonly`);
    }
};
const mutableHandlers = {
    get,
    set
};
const shallowReactiveHandlers = {
    get: shallowReactiveGet,
    set: shallowReactiveSet
};
const readonlyHandlers = extend({
    get: readonlyGet,
    ...readonlyObj
});
const shallowReadonlyHandlers = extend({
    get: shallowReadonlyGet,
    ...readonlyObj
});

function reactive(target) {
    return createReactiveObject(target, false, mutableHandlers);
}
function shallowReactive(target) {
    return createReactiveObject(target, false, shallowReactiveHandlers);
}
function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers);
}
function shallowReadonly(target) {
    return createReactiveObject(target, true, shallowReadonlyHandlers);
}
const reactiveMap = new WeakMap();
const readonlyMap = new WeakMap();
function createReactiveObject(target, isReadonly, baseHandler) {
    if (!isObject(target))
        return target;
    const proxyMap = isReadonly ? readonlyMap : reactiveMap;
    // 已经被代理了，直接返回代理
    if (proxyMap.has(target))
        return proxyMap.get(target);
    const proxy = new Proxy(target, baseHandler);
    proxyMap.set(target, proxy);
    return proxy;
}

function ref(value) {
    return createRef(value);
}
function shallowRef(value) {
    return createRef(value, true);
}
const convert = val => isObject(val) ? reactive(val) : val;
class RefImpl {
    _rawValue;
    _shallow;
    _value; // 表示声明了一个 _value 属性，但是没有赋值
    __v_isRef = true; // 产生的实例会被添加 __v_isRef 属性，表示是一个 ref 属性
    constructor(_rawValue, _shallow) {
        this._rawValue = _rawValue;
        this._shallow = _shallow;
        // 如果 _shallow 为 true，
        this._value = _shallow ? _rawValue : convert(_rawValue);
    }
    // 类的属性访问器
    get value() {
        track(this, TrackOpTypes.GET, 'value');
        return this._value;
    }
    set value(newValue) {
        if (hasChanged(newValue, this._rawValue)) {
            this._rawValue = newValue;
            this._value = this._shallow ? newValue : convert(newValue);
            trigger(this, TriggerOrTypes.SET, 'value', newValue);
        }
    }
}
function createRef(_rawValue, _shallow = false) {
    return new RefImpl(_rawValue, _shallow);
}
class ObjectRefImpl {
    _object;
    _key;
    __v_isRef = true;
    constructor(_object, _key) {
        this._object = _object;
        this._key = _key;
    }
    // 这里只是代理，如果原对象是响应式的数据，就会进行依赖收集
    get value() {
        return this._object[this._key];
    }
    // 同样，如果原对象是响应书的数据，就会触发更新
    set value(newValue) {
        if (hasChanged(newValue, this.value)) {
            this._object[this._key] = newValue;
        }
    }
}
// toRef 和 toRefs 作用是使从响应式对象中结构出来的数据也是响应式的
function toRef(target, key) {
    return new ObjectRefImpl(target, key);
}
function toRefs(target) {
    const res = isArray(target) ? Array(target.length) : {};
    for (let key in target) {
        res[key] = toRef(target, key);
    }
    return res;
}

class ComputedRefImpl {
    setter;
    _dirty = true;
    _value;
    effect;
    constructor(getter, setter) {
        this.setter = setter;
        this.effect = effect(getter, {
            lazy: true,
            scheduler: () => {
                if (!this._dirty) {
                    this._dirty = true;
                    // 触发更新
                    trigger(this, TriggerOrTypes.SET, 'value');
                }
            }
        });
    }
    get value() {
        // 如果是脏的需要重新取值，否则取缓存的值
        if (this._dirty) {
            this._value = this.effect();
            console.log('effect');
            this._dirty = false;
        }
        // computed 也要进行依赖收集
        track(this, TrackOpTypes.GET, 'value');
        return this._value;
    }
    set value(newValue) {
        this.setter(newValue);
    }
}
function computed(getterOrOptions) {
    let getter, setter;
    if (isFunction(getterOrOptions)) {
        getter = getterOrOptions;
        setter = () => {
            console.warn('computed value must be readonly');
        };
    }
    else {
        getter = getterOrOptions.get;
        setter = getterOrOptions.set;
    }
    return new ComputedRefImpl(getter, setter);
}

export { computed, effect, reactive, readonly, ref, shallowReactive, shallowReadonly, shallowRef, toRef, toRefs };
//# sourceMappingURL=reactivity.esm-bundler.js.map
