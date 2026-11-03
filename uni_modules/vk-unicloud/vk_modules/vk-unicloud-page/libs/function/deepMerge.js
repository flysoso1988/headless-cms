/**
 * 深度合并，source 优先，不修改输入对象
 * 仅普通对象递归合并；数组整体覆盖，null 和其他类型按 source 覆盖。
 * 普通对象、数组、Date、RegExp 会克隆；函数及其他实例保留引用。
 * @param {*} target 默认值
 * @param {*} source 覆盖值
 * @returns {*} 合并结果
 * vk.pubfn.deepMerge({ user: { role: 'admin', level: 2 } }, { user: { level: 5 } });
 */
function deepMerge(target = {}, source = {}) {
  const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const isPlainObject = (value) => {
    if (value === null || typeof value !== 'object') return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null) return true;
    return (
      hasOwn(prototype, 'constructor') &&
      typeof prototype.constructor === 'function' &&
      Function.prototype.toString.call(prototype.constructor) === Function.prototype.toString.call(Object)
    );
  };
  const setValue = (obj, key, value) => {
    // 按自有数据属性写入，避免 __proto__ 等键触发继承的 setter。
    Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
  };
  const cloneValue = (value) => {
    if (Array.isArray(value) || isPlainObject(value)) {
      const result = Array.isArray(value) ? new Array(value.length) : {};
      for (const key of Object.keys(value)) {
        setValue(result, key, cloneValue(value[key]));
      }
      return result;
    }
    const type = Object.prototype.toString.call(value);
    if (type === '[object Date]') return new Date(value.getTime());
    if (type === '[object RegExp]') {
      return Object.assign(new RegExp(value.source, value.flags), { lastIndex: value.lastIndex });
    }
    return value;
  };
  const merge = (defaultValue, customValue) => {
    if (!isPlainObject(defaultValue) || !isPlainObject(customValue)) return cloneValue(customValue);
    const result = {};
    for (const key of Object.keys(defaultValue)) {
      if (!hasOwn(customValue, key)) setValue(result, key, cloneValue(defaultValue[key]));
    }
    for (const key of Object.keys(customValue)) {
      const value = hasOwn(defaultValue, key) ? merge(defaultValue[key], customValue[key]) : cloneValue(customValue[key]);
      setValue(result, key, value);
    }
    return result;
  };
  return merge(target, source);
}

export default deepMerge;
