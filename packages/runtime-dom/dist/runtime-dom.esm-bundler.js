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

const patchAttr = (el, key, value) => {
    if (!value) {
        el.removeAttribute(key);
    }
    else {
        console.log(el, key, value);
        el.setAttribute(key, value);
    }
};

const patchClass = (el, value) => {
    if (!value) {
        value = '';
    }
    el.className = value;
};

const patchEvent = (el, key, value) => {
    const invokers = el._vei || (el._vei = {});
    const exists = invokers[key];
    if (value && exists) {
        // 以前绑定过事件，现在也有，只是事件执行函数不一样
        exists.value = value;
    }
    else {
        const eventName = key.slice(2).toLowerCase();
        if (value) {
            // 以前没有绑定过事件，要绑定
            let invoker = invokers[key] = createInvoker(value);
            el.addEventListener(eventName, invoker);
        }
        else {
            // 以前绑定过事件，现在没有了，要删除
            el.removeEventListener(eventName, exists);
            invokers[key] = undefined;
        }
    }
};
// 使用这种方式，当修改了事件的执行函数，直接改value就行，而不是先删除已经绑定的事件函数，然后再绑定事件
function createInvoker(value) {
    const invoker = (e) => {
        invoker.value(e);
    };
    invoker.value = value;
    return invoker;
}

const patchStyle = (el, prevValue, nextValue) => {
    const style = el.style;
    // 新的 style 没有值，直接清空
    if (!nextValue) {
        el.removeAttribute('style');
    }
    else {
        // 遍历新的style的属性，没有的直接赋值，有的直接新增
        for (let key in nextValue) {
            style[key] = nextValue[key];
        }
        // 遍历旧的style的属性，新的没有的删除
        if (prevValue) {
            for (let key in prevValue) {
                if (!nextValue[key]) {
                    style[key] = '';
                }
            }
        }
    }
};

const patchProp = (el, key, prevValue, nextValue) => {
    switch (key) {
        case 'class':
            patchClass(el, nextValue);
            break;
        case 'style':
            patchStyle(el, prevValue, nextValue);
            break;
        default:
            const reg = /^on[^a-z]/;
            // 事件
            if (reg.test(key)) {
                patchEvent(el, key, nextValue);
            }
            else {
                // 其他属性
                patchAttr(el, key, nextValue);
            }
            break;
    }
};

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
let currentInstance = null;
const setCurrentInstance = instance => {
    currentInstance = instance;
};
const getCurrentInstance = () => currentInstance;
function setupStatefulComponent(instance) {
    // 1. 代理，在应用的时候，可以在 render 的第一参数里直接拿到所有的数据
    instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);
    // 2. 执行组件的 setup 方法
    const Component = instance.type;
    const { setup } = Component;
    if (setup) {
        currentInstance = instance;
        const setupContext = createSetupContext(instance);
        const setupResult = setup(instance.props, setupContext);
        currentInstance = null;
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

const injectHook = (type, hook, target) => {
    if (!target) {
        return console.warn('injection APIs can only be used during execution of setup()');
    }
    const hooks = target[type] || (target[type] = []);
    // 子组件先 mounted ，父组件后 mounted ，为了保证 target 绑定的 hooks 是在自己的实例上
    const wrap = () => {
        setCurrentInstance(target); // 在给实例绑定 hooks 时，手动将 currentInstance 指向当前实例
        hook.call(target);
        setCurrentInstance(null);
    };
    hooks.push(wrap);
};
const createHook = (lifecycle) => (hook, target = currentInstance) => {
    injectHook(lifecycle, hook, target);
};
const invokeArrayFns = fns => {
    for (let i = 0; i < fns.length; i++) {
        fns[i]();
    }
};
const onBeforeMount = createHook("bm" /* BEFORE_MOUNT */);
const onMounted = createHook("m" /* MONTED */);
const onBeforeUpdate = createHook("bu" /* BEFORE_UPDATE */);
const onUpdated = createHook("u" /* UPDATED */);
const onBeforeUnmount = createHook("bum" /* BEFORE_UNMOUNT */);
const onUnmounted = createHook("um" /* UNMOUNTED */);

let queue = [];
function queueJob(job) {
    if (!queue.includes(job)) {
        queue.push(job);
        queueFlash();
    }
}
let isFlashPending = false;
function queueFlash() {
    if (!isFlashPending) {
        isFlashPending = true;
        Promise.resolve().then(flashJobs);
    }
}
function flashJobs() {
    isFlashPending = false;
    // effect 排序
    queue.sort((a, b) => a.id - b.id);
    for (let i = 0; i < queue.length; i++) {
        queue[i]();
    }
    queue.length = 0;
}

function createRenderer(renderOptions) {
    const { createElement: hostCreateElement, remove: hostRemove, insert: hostInsert, setElementText: hostSetElementText, patchProp: hostPatchProp, createText: hostCreateText, setText: hostSetText, nextSibling: hostNextSibling } = renderOptions;
    const setupRenderEffect = (instance, container) => {
        const componentEffect = () => {
            console.log('effect run');
            if (!instance.isMounted) {
                // 组件初次渲染
                const { bm, m } = instance;
                if (bm) {
                    invokeArrayFns(bm);
                }
                const subTree = instance.subTree = instance.render.call(instance.proxy, instance.proxy);
                // console.log('subTree', subTree)
                patch(null, subTree, container);
                instance.isMounted = true;
                if (m) {
                    invokeArrayFns(m);
                }
            }
            else {
                // 组件更新渲染 diff 算法
                console.log('组件更新');
                const { bu, u } = instance;
                if (bu) {
                    invokeArrayFns(bu);
                }
                const prevTree = instance.subTree;
                const nextTree = instance.render.call(instance.proxy, instance.proxy);
                patch(prevTree, nextTree, container);
                if (u) {
                    invokeArrayFns(u);
                }
            }
        };
        instance.update = effect(componentEffect, {
            scheduler: queueJob
        });
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
    const mountElement = (n2, container, anchor = null) => {
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
        hostInsert(el, container, anchor);
    };
    const patchProps = (el, oldProps, newProps) => {
        for (const key in newProps) {
            patchProp(el, key, oldProps[key], newProps[key]);
        }
        for (const key in oldProps) {
            if (newProps[key])
                continue;
            patchProp(el, key, oldProps[key], null);
        }
    };
    const patchElement = (n1, n2, container) => {
        // n1 和 n2 是相同的元素
        let el = n2.el = n1.el; // 复用旧的元素
        // 更新元素的属性，比对更新儿子
        const oldProps = n1.props || {};
        const newProps = n2.props || {};
        patchProps(el, oldProps, newProps);
        patchChildren(n1, n2, container);
    };
    const unmounChildren = children => {
        for (let i = 0; i < children.length; i++) {
            unmout(children[i]);
        }
    };
    const patchKeyedChildren = (c1, c2, el) => {
        let i = 0;
        let e1 = c1.length - 1;
        let e2 = c2.length - 1;
        // sync from start 从头开始比对，遇到不是相同的节点就停止
        while (i <= e1 && i <= e2) {
            const n1 = c1[i];
            const n2 = c2[i];
            if (isSameVnode(n1, n2)) {
                patch(n1, n2, el);
            }
            else {
                break;
            }
        }
        // sync from end 从尾开始比对，遇到不是相同的节点就停止
        while (i <= e1 && i <= e2) {
            const n1 = c1[e1];
            const n2 = c2[e2];
            if (isSameVnode(n1, n2)) {
                patch(n1, n2, el);
            }
            else {
                break;
            }
            e1--;
            e2--;
        }
        // 新的节点多，要新增
        if (i > e1) {
            // 要新增的是 i ~ e2 之间的节点
            if (i <= e2) {
                const nextPos = e2 + 1;
                // nextPos >= c2.length 表示在 c2 的尾部新增，否则表示不是在 c2 的尾部新增，需要插入新增节点的 anchor
                const anchor = nextPos >= c2.length ? null : c2[nextPos].el;
                while (i <= e2) {
                    patch(null, c2[i], el, anchor);
                    i++;
                }
            }
        }
        else if (i > e2) {
            // 新的节点少，删除c1 i ~ e2 之间的子节点
            while (i <= e2) {
                unmout(c1[i++]);
            }
        }
        else {
            // 乱序比对
            // Vue3 是用的节点做映射表，Vue2 是用老的节点做映射表
            let s1 = i, s2 = i;
            const keyToNewIndexMap = new Map();
            for (let i = s2; i < e2; i++) {
                const childVnode = c2[i];
                keyToNewIndexMap.set(childVnode.key, i);
            }
            const toBePatched = e2 - s2 + 1;
            // newIndexToOldIndexMap 用来记录映射表的哪些节点被复用了，不为 0 表示已被复用了
            const newIndexToOldIndexMap = new Array(toBePatched).fill(0);
            // 遍历老的节点，在映射表里查找能复用的节点
            for (let i = s1; i < e1; i++) {
                const oldVnode = c1[i];
                let newIndex = keyToNewIndexMap.get(oldVnode.key);
                // 老的节点在映射表中没有找到，删除老节点
                if (!newIndex) {
                    unmout(oldVnode);
                }
                else {
                    newIndexToOldIndexMap[newIndex - s2] = i + 1;
                    // 这里调用 patch 使 c2[newIndex] 复用了旧的子节点的 el
                    patch(oldVnode, c2[newIndex], el);
                }
            }
            // 上面在映射表中找的节点的位置还是用的老节点的位置，还需要更新上面在映射表中找的节点的位置，同时还需要新增上面映射表中没有用到的节点
            const increasingNewIndexSequence = getSequence(newIndexToOldIndexMap);
            let j = increasingNewIndexSequence.length - 1;
            for (let i = toBePatched - 1; i >= 0; i--) {
                let currentIndex = i + s2;
                let childVnode = c2[currentIndex];
                let anchor = currentIndex + 1 >= c2.length ? null : c2[currentIndex + 1].el;
                // 映射表中没有被复用的节点，新增
                if (newIndexToOldIndexMap[i] === 0) {
                    patch(null, childVnode, el, anchor);
                }
                else {
                    // 映射表中已经被复用的节点，此时该节点的 el 已经有了，复用了旧的子节点
                    // 这里使用这种方式，把所有的新节点都插入了一遍，性能还有优化空间，所以引出了 最长递增子序列
                    // hostInsert(childVnode.el, el, anchor)
                    // 是最长递增子序列里包含的节点不需要插入
                    if (i !== increasingNewIndexSequence[j]) {
                        hostInsert(childVnode.el, el, anchor);
                    }
                    else {
                        // 跳过不需要移动的元素
                        j--;
                    }
                }
            }
        }
    };
    const getSequence = (arr) => {
        const len = arr.length;
        const result = [0];
        const p = arr.slice();
        let start, end, middle;
        for (let i = 1; i < len; i++) {
            const arrI = arr[i];
            if (arrI !== 0) {
                let resultLastIndex = result[result.length - 1];
                if (arrI > arr[resultLastIndex]) {
                    p[i] = resultLastIndex;
                    result.push(i);
                    continue;
                }
                // 二分查找
                start = 0;
                end = result.length - 1;
                while (start < end) {
                    middle = Math.floor((start + end) / 2);
                    if (arr[result[middle]] < arrI) {
                        start = middle + 1;
                    }
                    else {
                        end = middle - 1;
                    }
                }
                if (arrI < arr[result[start]]) {
                    if (start > 0) {
                        p[i] = result[start - 1];
                    }
                    result[start] = i;
                }
            }
        }
        let l = result.length;
        let last = result[l - 1];
        while (l-- > 0) {
            result[l] = last;
            last = p[last];
        }
        return result;
    };
    const patchChildren = (n1, n2, el) => {
        const c1 = n1.children;
        const c2 = n2.chilren;
        // 新的有儿子，老的有儿子，新老都有儿子，新老都是文本
        const prevShapeFlag = c1.shapeFlag;
        const shapeFlag = n2.shapeFlag;
        // 新的儿子是文本
        if (shapeFlag & 8 /* TEXT_CHILDREN */) {
            // 旧的儿子是数组
            if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
                // 删除儿子
                unmounChildren(c1);
            }
            // 新老儿子都是文本
            if (c1 !== c2) {
                hostSetElementText(el, c2);
            }
        }
        else {
            // 新的儿子是数组
            if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
                // 新老儿子都是数组
                if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                    // diff 算法核心
                    patchKeyedChildren(c1, c2, el);
                }
                else {
                    unmounChildren(c1);
                }
            }
            else {
                // 老的儿子是文本
                if (prevShapeFlag & 8 /* TEXT_CHILDREN */) {
                    hostSetElementText(el, '');
                }
                // 新的儿子是数组
                if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                    mountChildren(c2, el);
                }
            }
        }
    };
    const processElement = (n1, n2, container, anchor) => {
        if (!n1) {
            // 挂载元素
            mountElement(n2, container, anchor);
        }
        else {
            // 更新元素
            patchElement(n1, n2, container);
        }
    };
    const processText = (n1, n2, container) => {
        if (!n1) {
            hostInsert(n2.el = hostCreateText(n2.children), container);
        }
    };
    const isSameVnode = (n1, n2) => n1.type === n2.type && n1.key === n2.key;
    const unmout = (n1) => {
        // 如果是组件，还需要调用组件的销毁方法
        hostRemove(n1.el);
    };
    const patch = (n1, n2, container, anchor = null) => {
        const { shapeFlag, type } = n2;
        // n1 和 n2 不是相同节点，删除 n1, 挂载 n2
        if (n1 && !isSameVnode(n1, n2)) {
            anchor = hostNextSibling(n1.el);
            unmout(n1);
            n1 = null;
        }
        switch (type) {
            case Text:
                processText(n1, n2, container);
                break;
            default:
                if (shapeFlag & 1 /* ELEMENT */) {
                    console.log('元素');
                    processElement(n1, n2, container, anchor);
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

const nodeOps = {
    // 新增元素
    createElement: (tagName) => document.createElement(tagName),
    // 删除元素
    remove: (child) => {
        const parent = child.parentNode;
        if (parent) {
            parent.removeChild(child);
        }
    },
    // 插入元素, anchor = null 相当于 appendChild
    insert: (child, parent, anchor = null) => parent.insertBefore(child, anchor),
    // 查找元素
    querySelector: (selector) => document.querySelector(selector),
    // 设置元素文本内容
    setElementText: (el, text) => {
        el.textContent = text;
    },
    nextSibling: node => node.nextSibling,
    // 创建文本
    createText: text => document.createTextNode(text),
    // 设置文本
    setText: (node, text) => node.textContent = text
};

// 渲染时用到的所有方法
const renderOptions = extend({ patchProp }, nodeOps);
function createApp(rootComponent, rootProps = null) {
    const app = createRenderer(renderOptions).createApp(rootComponent, rootProps);
    let { mount } = app;
    // 重写 mount 方法，做一些其他的操作
    app.mount = (container) => {
        // 先清空容器的内容
        const el = nodeOps.querySelector(container);
        el.innerHTML = '';
        // 将组件渲染成的 DOM 元素，挂载到 el 上
        mount(el);
    };
    return app;
}

export { createApp, getCurrentInstance, h, onBeforeMount, onBeforeUnmount, onBeforeUpdate, onMounted, onUnmounted, onUpdated, renderOptions };
//# sourceMappingURL=runtime-dom.esm-bundler.js.map
