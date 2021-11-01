const isObject = value => typeof value === 'object' && value !== null;
const extend = Object.assign;
const isArray = Array.isArray;
const isFunction = value => typeof value === 'function';
const isString = value => typeof value === 'string';
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
const readonlyObj = {
    set: (target, key) => {
        console.warn(`cannot set key ${key} is readonly`);
    }
};
const mutableHandlers = {
    get,
    set
};
const readonlyHandlers = extend({
    get: readonlyGet,
    ...readonlyObj
});
extend({
    get: shallowReadonlyGet,
    ...readonlyObj
});

function reactive(target) {
    return createReactiveObject(target, false, mutableHandlers);
}
function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers);
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

function createVNode(type, props, children = null) {
    const shapeFlag = isString(type) ? 1 /* ELEMENT */ : isObject(type) ? 4 /* STATEFUL_COMPONENT */ : 0;
    const vnode = {
        __v_isVnode: true,
        type,
        props,
        children,
        Component: null,
        el: null,
        key: props?.key,
        shapeFlag
    };
    normalizeChildren(vnode, children);
    return vnode;
}
function isVnode(vnode) {
    return vnode.__v_isVnode;
}
function normalizeChildren(vnode, children) {
    let type = 0;
    if (!children) ;
    else if (isArray(children)) {
        type = 16 /* ARRAY_CHILDREN */;
    }
    else {
        type = 8 /* TEXT_CHILDREN */;
    }
    // 用于后面判断 children 的类型
    vnode.shapeFlag = vnode.shapeFlag | type;
}
const Text = Symbol('text');
const normalizeVnode = child => {
    if (isObject(child))
        return child;
    return createVNode(Text, null, String(child));
};

function createAppAPI(render) {
    return function createApp(rootComponent, rootProps) {
        const app = {
            _props: rootProps,
            _component: rootComponent,
            _container: null,
            // 告诉 core 创建的应用挂载到哪里
            mount(container) {
                // 1. 根据组件创建虚拟节点vnode
                const vnode = createVNode(rootComponent, rootProps);
                // console.log(vnode)
                // 2. 调用 render 方法进行渲染
                render(vnode, container);
                app._container = container;
            }
        };
        return app;
    };
}

const PublicInstanceProxyHandlers = {
    get({ _: instance }, key) {
        // 不允许访问以 $ 开头的属性
        if (key[0] === '$')
            return;
        // 取值时，访问 setupState, props, data
        const { setupState, props, data } = instance;
        if (hasOwn(setupState, key)) {
            return setupState[key];
        }
        else if (hasOwn(data, key)) {
            return data[key];
        }
        else if (hasOwn(props, key)) {
            return props[key];
        }
        else {
            return undefined;
        }
    },
    set({ _: instance }, key, value) {
        const { setupState, props, data } = instance;
        if (hasOwn(setupState, key)) {
            setupState[key] = value;
        }
        else if (hasOwn(data, key)) {
            data[key] = value;
        }
        else if (hasOwn(props, key)) {
            props[key] = value;
        }
    }
};

function createComponentInstance(vnode) {
    const instance = {
        vnode,
        type: vnode.type,
        props: {},
        attrs: {},
        slots: {},
        ctx: {},
        data: {},
        setupState: {},
        render: null,
        isMounted: false // 表示组件是否已经挂载过
    };
    instance.ctx = { _: instance };
    return instance;
}
function setupComonent(instance) {
    const { props, children, shapeFlag } = instance.vnode;
    instance.props = props;
    instance.children = children;
    const isStateful = shapeFlag & 4 /* STATEFUL_COMPONENT */;
    // 带状态的组件
    if (isStateful) {
        setupStatefulComponent(instance);
    }
}
function setupStatefulComponent(instance) {
    // 1. 代理，在应用的时候，可以在 render 的第一参数里直接拿到所有的数据
    instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);
    // 2. 执行组件的 setup 方法
    const Component = instance.type;
    const { setup } = Component;
    if (setup) {
        const setupContext = createSetupContext(instance);
        const setupResult = setup(instance.props, setupContext);
        handleSetupResult(instance, setupResult);
    }
    else {
        finishComponentSetup(instance);
    }
}
function handleSetupResult(instance, setupResult) {
    // setup 里返回的 render 的优先级高于 render
    if (isFunction(setupResult)) {
        instance.render = setupResult;
    }
    else if (isObject(setupResult)) {
        instance.setupState = setupResult;
    }
    finishComponentSetup(instance);
}
function finishComponentSetup(instance) {
    const Component = instance.type;
    if (!instance.render) {
        // 对 template 模板进行编译，生成 render 函数
        if (!Component.render && Component.template) ;
        instance.render = Component.render;
    }
}
function createSetupContext(instance) {
    return {
        attrs: instance.attrs,
        // props: instance.props,
        slots: instance.slots,
        emit: () => { },
        expose: () => { }
    };
}

function createRenderer(renderOptions) {
    const { createElement: hostCreateElement, remove: hostRemove, insert: hostInsert, setElementText: hostSetElementText, patchProp: hostPatchProp, createText: hostCreateText, setText: hostSetText } = renderOptions;
    const setupRenderEffect = (instance, container) => {
        const componentEffect = () => {
            console.log('effect run');
            if (!instance.isMounted) {
                // 组件初次渲染
                const subTree = instance.subTree = instance.render.call(instance.proxy, instance.proxy);
                // console.log('subTree', subTree)
                patch(null, subTree, container);
                instance.isMounted = true;
            }
            else {
                // 组件更新渲染
                console.log('组件更新');
            }
        };
        instance.update = effect(componentEffect);
    };
    const mountComponent = (n2, container) => {
        // 1. 创建组件实例
        const instance = n2.component = createComponentInstance(n2);
        // 2. 将需要的数据挂载到实例上
        setupComonent(instance);
        // 3. 创建一个 effect，让 render 函数执行
        setupRenderEffect(instance, container);
    };
    const processComponent = (n1, n2, container) => {
        if (!n1) {
            // 组件挂载
            mountComponent(n2, container);
        }
    };
    const mountChildren = (chilren, container) => {
        for (let i = 0; i < chilren.length; i++) {
            let child = normalizeVnode(chilren[i]); // 处理多个 children 内容都是文本的情况
            patch(null, child, container);
        }
    };
    const mountElement = (n2, container) => {
        const { type, props, shapeFlag, children } = n2;
        // console.log(type, props, shapeFlag, children)
        let el = n2.el = hostCreateElement(type);
        if (props) {
            for (const key in props) {
                hostPatchProp(el, key, null, props[key]);
            }
        }
        if (shapeFlag & 8 /* TEXT_CHILDREN */) {
            hostSetElementText(el, children);
        }
        else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
            mountChildren(children, el);
        }
        hostInsert(el, container);
    };
    const processElement = (n1, n2, container) => {
        if (!n1) {
            // 挂载元素
            mountElement(n2, container);
        }
    };
    const processText = (n1, n2, container) => {
        if (!n1) {
            hostInsert(n2.el = hostCreateText(n2.children), container);
        }
    };
    const patch = (n1, n2, container) => {
        const { shapeFlag, type } = n2;
        switch (type) {
            case Text:
                processText(n1, n2, container);
                break;
            default:
                if (shapeFlag & 1 /* ELEMENT */) {
                    console.log('元素');
                    processElement(n1, n2, container);
                }
                else if (shapeFlag & 4 /* STATEFUL_COMPONENT */) {
                    console.log('组件');
                    processComponent(n1, n2, container);
                }
                break;
        }
    };
    const render = (n2, container) => {
        patch(null, n2, container);
    };
    return {
        createApp: createAppAPI(render)
    };
}

function h(type, typeOrChildren, children) {
    // console.log(type, typeOrChildren, children)
    const len = arguments.length;
    // 类型 + 属性 || 类型 + children
    if (len === 2) {
        // 类型 + 属性
        if (isObject(typeOrChildren) && !isArray(typeOrChildren)) {
            if (isVnode(typeOrChildren)) {
                return createVNode(type, null, [typeOrChildren]);
            }
            else {
                return createVNode(type, null, typeOrChildren);
            }
        }
        else {
            // 类型 + children
            return createVNode(type, null, typeOrChildren);
        }
    }
    else {
        if (len > 3) {
            children = Array.prototype.slice.call(arguments, 2);
        }
        else if (len === 3 && isVnode(children)) {
            children = [children];
        }
        return createVNode(type, typeOrChildren, children);
    }
}

export { createRenderer, h };
//# sourceMappingURL=runtime-core.esm-bundler.js.map
