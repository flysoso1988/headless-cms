'use strict';
/**
 * 内容写入（add / update）共用模块
 *
 * 1. 按模型字段定义生成写入白名单（prefactor：此前 add / update 各自重复这段逻辑）
 * 2. 动态区块（dynamiczone）字段的递归一层白名单校验：
 *    - 字段值必须是数组
 *    - 每块的 __component 必须在该字段声明的允许组件集合内
 *    - 块内键过滤至该组件模型的字段白名单（不深挖 json 子结构，深度一层）
 *    - 组件模型已不存在时白名单无从获取，该块原样保留（不静默清空）
 *
 * 违规返回 { code: -1, msg }，错误消息含字段名与块序号。
 */
const db = uniCloud.database(); // 全局数据库引用
const _ = db.command; // 数据库操作符
const dbName = require('../../../../../dao/config.js');

/**
 * 读取字段声明允许的组件集合
 * 优先 settings.components（schema 的 settings 通道），兼容顶层 components
 * @param {Object} field 字段定义
 * @returns {String[]} 组件模型 key 数组
 */
function getAllowedComponents(field = {}) {
  if (field.settings && Array.isArray(field.settings.components)) return field.settings.components;
  if (Array.isArray(field.components)) return field.components;
  return [];
}

/**
 * 批量查询组件模型的字段 key 白名单
 * @param {Object} options
 * @param {Object} options.vk vk 实例
 * @param {String[]} options.componentKeys 组件模型 key 数组
 * @returns {Object} { [组件模型 key]: [字段 key, ...] }
 */
async function loadComponentFieldMap({ vk, componentKeys = [] }) {
  let map = {};
  if (componentKeys.length === 0) return map;
  // 组件模型 key → 模型 _id
  let modelRes = await vk.baseDao.select({
    dbName: dbName.model,
    whereJson: { key: _.in(componentKeys) },
    pageSize: -1,
  });
  let models = modelRes.rows || [];
  if (models.length === 0) return map;
  // 模型 _id → 字段 key 白名单
  let fieldRes = await vk.baseDao.select({
    dbName: dbName.modelField,
    whereJson: { model_id: _.in(models.map((m) => m._id)) },
    pageSize: -1,
  });
  let fields = fieldRes.rows || [];
  models.forEach((model) => {
    map[model.key] = fields.filter((f) => f.model_id === model._id).map((f) => f.key);
  });
  return map;
}

/**
 * 动态区块字段值的校验与一层白名单过滤（保留块顺序）
 * @param {Object} options
 * @param {Object} options.field 动态区块字段定义
 * @param {*} options.value 字段提交值
 * @param {Object} options.componentFieldMap 组件模型字段白名单
 * @returns {{code:Number, msg:String, value?:Array}}
 */
function normalizeDynamicZone({ field = {}, value, componentFieldMap = {} }) {
  let fieldName = field.title || field.key;
  if (!Array.isArray(value)) {
    return { code: -1, msg: `字段「${fieldName}」的值必须是数组` };
  }
  let allowedComponents = getAllowedComponents(field);
  let blocks = [];
  for (let i = 0; i < value.length; i++) {
    let block = value[i] || {};
    let componentKey = block.__component;
    if (!componentKey || allowedComponents.indexOf(componentKey) === -1) {
      return { code: -1, msg: `字段「${fieldName}」第 ${i + 1} 个区块使用了未允许的组件「${componentKey || '空'}」` };
    }
    let allowedKeys = componentFieldMap[componentKey];
    if (!allowedKeys) {
      // 组件模型已删除（字段声明的允许组件里残留了已不存在模型的 key）：白名单无从获取，
      // 此时原样保留整块，而不是把块内字段静默清空（与 spec「后台不做未知组件数据的自动清洗」一致）
      blocks.push(Object.assign({}, block));
      continue;
    }
    let newBlock = { __component: componentKey };
    allowedKeys.forEach((key) => {
      if (block[key] !== undefined) {
        newBlock[key] = block[key];
      }
    });
    blocks.push(newBlock);
  }
  return { code: 0, msg: '', value: blocks };
}

/**
 * 根据模型字段定义构建内容写入数据
 * @param {Object} options
 * @param {Object} options.vk vk 实例
 * @param {Object} options.data 前端提交的原始数据
 * @param {Array} options.modelFields 模型字段定义数组（vk-cms-model-field 记录）
 * @returns {Promise<{code:Number, msg:String, dataJson:Object}>}
 */
async function buildContentFieldData({ vk, data = {}, modelFields = [] }) {
  // 兼容 vk.baseDao.selects 的两种返回：getMain 时直接返回数组，否则为 { rows }
  let fields = Array.isArray(modelFields) ? modelFields : (modelFields && modelFields.rows) || [];
  // 一次性收集所有动态区块字段声明的组件，避免逐块查库
  let componentKeys = [];
  fields.forEach((field) => {
    if (field.type !== 'dynamiczone' || data[field.key] === undefined) return;
    getAllowedComponents(field).forEach((key) => {
      if (componentKeys.indexOf(key) === -1) componentKeys.push(key);
    });
  });
  let componentFieldMap = await loadComponentFieldMap({ vk, componentKeys });

  let dataJson = {};
  for (let i = 0; i < fields.length; i++) {
    let field = fields[i];
    let key = field.key;
    if (data[key] === undefined) continue;
    if (field.type !== 'dynamiczone') {
      dataJson[key] = data[key];
      continue;
    }
    let result = normalizeDynamicZone({ field, value: data[key], componentFieldMap });
    if (result.code !== 0) return result;
    dataJson[key] = result.value;
  }
  return { code: 0, msg: '', dataJson };
}

module.exports = {
  buildContentFieldData,
};
