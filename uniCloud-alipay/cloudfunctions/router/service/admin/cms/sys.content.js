'use strict';
let vk = uniCloud.vk; // 全局vk实例
// 涉及的表名
const dbName = require('../../../dao/config.js');

const db = uniCloud.database(); // 全局数据库引用
const _ = db.command; // 数据库操作符
const $ = _.aggregate; // 聚合查询操作符

/* ============ 内容写入共用逻辑（字段白名单 + 动态区块校验） ============ */

// 内容系统保留字段：由基础字段统一写入，模型字段即使同名也不得覆盖
const RESERVED_CONTENT_KEYS = [
  'model_key',
  'document_id',
  'locale',
  'status',
  'created_by_id',
  'updated_by_id',
  'user_id',
  'is_delete',
  '_add_time',
  '_update_time',
  '_update_time_str',
];

function isReservedContentKey(key) {
  return RESERVED_CONTENT_KEYS.indexOf(key) !== -1;
}

// 是否超管（与 vk 内置 sys 权限判定保持一致，仅 admin 角色拥有全量数据权限）
function isAdminUser(userInfo = {}) {
  return Array.isArray(userInfo.role) && userInfo.role.indexOf('admin') !== -1;
}

/**
 * 内容级操作范围校验：非超管只能操作自己创建的内容。
 * 历史数据没有 created_by_id 时放行，避免影响已上线内容。
 */
function checkContentOperateScope({ userInfo = {}, uid, record = {} }) {
  if (isAdminUser(userInfo)) return null;
  if (vk.pubfn.isNull(record.created_by_id)) return null;
  if (record.created_by_id !== uid) return { code: 403, msg: '无权操作他人创建的内容' };
  return null;
}

// 剔除 undefined，避免数据库驱动把未传字段写成 null
function stripUndefined(obj = {}) {
  let result = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) result[key] = obj[key];
  });
  return result;
}

// (document_id, locale, status) 唯一定位条件：locale 为空时按字段不存在处理
// 双记录模型下同一 document_id + locale 最多两条：草稿（status:false）与已发布（status:true）
function buildContentUniqueWhere({ document_id, locale, status }) {
  let whereJson = { document_id };
  whereJson.locale = vk.pubfn.isNull(locale) ? _.exists(false) : locale;
  if (status === true || status === false) whereJson.status = status;
  return whereJson;
}

// status 归一化：未传时沿用 fallback，传入时必须为布尔值
function normalizeStatus(value, fallback) {
  if (value === undefined || value === null) return { code: 0, value: fallback };
  if (typeof value !== 'boolean') return { code: -1, msg: 'status 必须为布尔值' };
  return { code: 0, value };
}

/* ============ 内容列表去重（草稿/发布双记录模型，单段聚合） ============ */

// 列表行必须携带的字段（行操作依赖），即使 display_fields 未勾选也要返回
const CONTENT_LIST_REQUIRED_KEYS = ['_id', 'document_id', 'model_key', 'status', 'locale', '_add_time'];

// 聚合字段白名单必须排除的内部字段
const CONTENT_LIST_EXCLUDED_KEYS = ['created_by_id', 'updated_by_id', 'user_id', 'is_delete', '_update_time', '_update_time_str'];

// 分组字段 / 取值数组字段前缀，避免与模型字段、分组键冲突
const CONTENT_GROUP_KEY_PREFIX = '_gk_';
const CONTENT_VALUE_KEY_PREFIX = '_vf_';

// 合法字段名：字母或下划线开头，仅含字母数字下划线（天然排除 $ 与 .）
const CONTENT_FIELD_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

// 字段名是否可安全地拼进聚合表达式
function isSafeContentFieldKey(key) {
  if (typeof key !== 'string' || key.length === 0) return false;
  if (key.charAt(0) === '$') return false;
  if (key.indexOf('.') !== -1) return false;
  if (!CONTENT_FIELD_KEY_PATTERN.test(key)) return false;
  if (CONTENT_LIST_EXCLUDED_KEYS.indexOf(key) !== -1) return false;
  return true;
}

// 构建列表展示字段白名单：模型字段 ∪ 必需字段；display_fields 非空时取交集
function buildContentListFieldKeys(model = {}, modelFields = []) {
  let displayFields = Array.isArray(model.display_fields) ? model.display_fields : [];
  let limitByDisplay = displayFields.length > 0;
  let keys = [];
  let pushKey = (key) => {
    if (!isSafeContentFieldKey(key)) return;
    if (keys.indexOf(key) === -1) keys.push(key);
  };
  modelFields.forEach((field) => {
    if (!field || typeof field.key !== 'string') return;
    if (limitByDisplay && displayFields.indexOf(field.key) === -1) return;
    pushKey(field.key);
  });
  CONTENT_LIST_REQUIRED_KEYS.forEach(pushKey);
  return keys;
}

// 前端排序列 → 分组后累加器字段的映射；映射表外的字段回退默认排序
function buildContentListSortArr(sortRule) {
  let list = Array.isArray(sortRule) ? sortRule : [];
  let sortArr = [];
  list.forEach((item) => {
    if (!item) return;
    let type = item.type === 'asc' ? 'asc' : 'desc';
    if (item.name === '_add_time') {
      sortArr.push({ name: CONTENT_GROUP_KEY_PREFIX + 'add_time', type });
    } else if (item.name === '_id') {
      sortArr.push({ name: CONTENT_GROUP_KEY_PREFIX + 'id', type });
    }
  });
  if (sortArr.length === 0) sortArr.push({ name: CONTENT_GROUP_KEY_PREFIX + 'id', type: 'desc' });
  return sortArr;
}

// 单段聚合的分组结构：分组键 + 状态/时间/ID 累加器 + 展示字段的 $push 数组
// $push 遇到字段缺失会跳过元素导致各数组下标错位，必须用 $ifNull 补 null 保证对齐
function buildContentGroupJson(fieldKeys = []) {
  let groupJson = {
    _id: { document_id: '$document_id', locale: { $ifNull: ['$locale', ''] } },
  };
  groupJson[CONTENT_GROUP_KEY_PREFIX + 'status'] = { $max: '$status' };
  groupJson[CONTENT_GROUP_KEY_PREFIX + 'add_time'] = { $max: '$_add_time' };
  groupJson[CONTENT_GROUP_KEY_PREFIX + 'id'] = { $max: '$_id' };
  fieldKeys.forEach((key) => {
    groupJson[CONTENT_VALUE_KEY_PREFIX + key] = { $push: { $ifNull: ['$' + key, null] } };
  });
  return groupJson;
}

// 统一时间比较口径（兼容数字时间戳、Date、数字字符串）
function getContentSortValue(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) return Number(value);
  return 0;
}

// a 是否比 b 更新（_add_time 降序，_id 兜底）
function isLaterContentRow(timeA, idA, timeB, idB) {
  if (timeB === undefined || timeB === null) return true;
  let sortA = getContentSortValue(timeA);
  let sortB = getContentSortValue(timeB);
  if (sortA > sortB) return true;
  if (sortA === sortB) return String(idA || '') > String(idB || '');
  return false;
}

// 分组结果拍平成原始行结构：已发布优先，其次草稿，均取最新一条
function flattenContentListGroupRows(rows = [], fieldKeys = []) {
  let result = [];
  rows.forEach((group) => {
    if (!group) return;
    let statusArr = group[CONTENT_VALUE_KEY_PREFIX + 'status'] || [];
    let timeArr = group[CONTENT_VALUE_KEY_PREFIX + '_add_time'] || [];
    let idArr = group[CONTENT_VALUE_KEY_PREFIX + '_id'] || [];
    let publishedIndex = -1;
    let draftIndex = -1;
    for (let i = 0; i < statusArr.length; i++) {
      if (statusArr[i] === true) {
        if (publishedIndex === -1 || isLaterContentRow(timeArr[i], idArr[i], timeArr[publishedIndex], idArr[publishedIndex])) publishedIndex = i;
      } else if (statusArr[i] === false) {
        if (draftIndex === -1 || isLaterContentRow(timeArr[i], idArr[i], timeArr[draftIndex], idArr[draftIndex])) draftIndex = i;
      }
    }
    let pickIndex = publishedIndex !== -1 ? publishedIndex : draftIndex;
    if (pickIndex === -1) pickIndex = 0;
    let row = {};
    fieldKeys.forEach((key) => {
      let valueArr = group[CONTENT_VALUE_KEY_PREFIX + key];
      row[key] = Array.isArray(valueArr) ? valueArr[pickIndex] : undefined;
    });
    // 分组键兜底，保证 document_id / locale 与分组结果一致
    row.document_id = group._id ? group._id.document_id : row.document_id;
    if (group._id && group._id.locale) {
      row.locale = group._id.locale;
    } else if (row.locale !== undefined) {
      delete row.locale;
    }
    result.push(row);
  });
  return result;
}

// 按 key 读取内容模型（含 draft / type / display_fields）
async function loadContentListModel(modelKey) {
  if (vk.pubfn.isNull(modelKey)) return null;
  return await vk.baseDao.select({
    dbName: dbName.model,
    whereJson: { key: modelKey },
    getOne: true,
    getMain: true,
  });
}

// 原有列表查询逻辑（非草稿箱模型 / 非集合模型 / 无法定位模型时保持原行为）
async function getContentListLegacy(data, locale, status) {
  let andArr = [];
  if (vk.pubfn.isNotNull(locale)) {
    andArr.push({ locale });
  }
  if (status !== undefined && status !== null) {
    andArr.push({ status });
  }
  return await vk.baseDao.getTableData({
    dbName: dbName.content,
    data,
    whereJson: andArr.length > 0 ? _.and(andArr) : {},
  });
}

// 必填字段判空（false / 0 视为有效值）
function isFieldValueEmpty(field = {}, value) {
  if (vk.pubfn.isNull(value)) return true;
  if (field.type === 'checkbox' && Array.isArray(value) && value.length === 0) return true;
  return false;
}

// 按模型字段 type 做基础类型校验（不做类型转换，保持入库值与前端一致）
function getFieldValueError({ field = {}, value }) {
  let title = field.title || field.key;
  let type = field.type;
  if (type === 'switch') {
    return typeof value === 'boolean' ? null : `字段「${title}」必须为布尔值`;
  }
  if (type === 'number') {
    if (typeof value === 'number' && isFinite(value)) return null;
    if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) return null;
    return `字段「${title}」必须为数字`;
  }
  if (type === 'checkbox') {
    if (!Array.isArray(value)) return `字段「${title}」必须为数组`;
    if (Array.isArray(field.data) && field.data.length > 0) {
      let allowed = field.data.map((item) => String(item.value));
      for (let i = 0; i < value.length; i++) {
        if (allowed.indexOf(String(value[i])) === -1) return `字段「${title}」包含非法选项值「${value[i]}」`;
      }
    }
    return null;
  }
  if (type === 'radio' || type === 'select') {
    if (typeof value !== 'string' && typeof value !== 'number') return `字段「${title}」值类型不正确`;
    if (Array.isArray(field.data) && field.data.length > 0) {
      let allowed = field.data.map((item) => String(item.value));
      if (allowed.indexOf(String(value)) === -1) return `字段「${title}」的值「${value}」不在选项范围内`;
    }
    return null;
  }
  if (type === 'json') {
    if (typeof value === 'object') return null;
    if (typeof value === 'string') {
      try {
        JSON.parse(value);
        return null;
      } catch (err) {
        return `字段「${title}」不是合法的 JSON`;
      }
    }
    return `字段「${title}」必须为对象、数组或 JSON 字符串`;
  }
  if (type === 'component') {
    return typeof value === 'object' && !Array.isArray(value) ? null : `字段「${title}」必须为对象`;
  }
  if (type === 'file-select') {
    return typeof value === 'string' || Array.isArray(value) ? null : `字段「${title}」必须为字符串或数组`;
  }
  if (type === 'date' || type === 'datetime' || type === 'time') {
    return typeof value === 'string' || typeof value === 'number' ? null : `字段「${title}」必须为日期/时间字符串或时间戳`;
  }
  if (type === 'text' || type === 'textarea' || type === 'editor' || type === 'color' || type === 'relation' || type === 'remote-select') {
    return typeof value === 'string' ? null : `字段「${title}」必须为字符串`;
  }
  // 未知类型不额外限制，避免阻塞后续新增字段类型
  return null;
}

/**
 * 读取字段声明允许的组件集合
 * 优先 settings.components（schema 的 settings 通道），兼容顶层 components
 */
function getAllowedComponents(field = {}) {
  if (field.settings && Array.isArray(field.settings.components)) return field.settings.components;
  if (Array.isArray(field.components)) return field.components;
  return [];
}

/**
 * 批量查询组件模型的字段 key 白名单
 * @returns {Object} { [组件模型 key]: [字段 key, ...] }
 */
async function loadComponentFieldMap({ componentKeys = [] }) {
  let map = {};
  if (componentKeys.length === 0) return map;
  let modelRes = await vk.baseDao.select({
    dbName: dbName.model,
    whereJson: { key: _.in(componentKeys) },
    pageSize: -1,
  });
  let models = modelRes.rows || [];
  if (models.length === 0) return map;
  let fieldRes = await vk.baseDao.select({
    dbName: dbName.modelField,
    whereJson: { model_key: _.in(componentKeys) },
    pageSize: -1,
  });
  let fields = fieldRes.rows || [];
  models.forEach((model) => {
    map[model.key] = fields.filter((f) => f.model_key === model.key).map((f) => f.key);
  });
  return map;
}

/**
 * 动态区块字段值的校验与一层白名单过滤（保留块顺序）
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
      // 组件模型已删除：白名单无从获取，原样保留整块（不静默清空）
      blocks.push(Object.assign({}, block));
      continue;
    }
    let newBlock = { __component: componentKey };
    allowedKeys.forEach((key) => {
      if (block[key] !== undefined) newBlock[key] = block[key];
    });
    blocks.push(newBlock);
  }
  return { code: 0, msg: '', value: blocks };
}

/**
 * 查询模型字段定义
 */
async function loadModelFields({ model_key }) {
  return await vk.baseDao.selects({
    dbName: dbName.modelField,
    getMain: true,
    pageIndex: 1,
    pageSize: -1,
    // 主表where条件
    whereJson: { model_key },
  });
}

/**
 * 校验模型存在且允许写入内容（组件模型仅用于动态区块，不允许直接写内容）
 */
async function getWritableContentModel(model_key) {
  // vk.baseDao.select 的 getOne 必须配合 getMain:true 才直接返回单条文档，否则返回的是 { rows }
  let model = await vk.baseDao.select({
    dbName: dbName.model,
    whereJson: { key: model_key },
    getOne: true,
    getMain: true,
  });
  if (!model) return { code: -1, msg: `模型「${model_key}」不存在` };
  if (model.type === 'component') return { code: -1, msg: `模型「${model_key}」为组件模型，不允许写入内容` };
  return { code: 0, model };
}

/**
 * 根据模型字段定义构建内容写入数据
 * @param {String} mode add 模式下校验全部必填字段；update 模式只校验显式传入的字段
 */
async function buildContentFieldData({ data = {}, modelFields = [], mode = 'update' }) {
  let fields = Array.isArray(modelFields) ? modelFields : (modelFields && modelFields.rows) || [];
  // 一次性收集所有动态区块字段声明的组件，避免逐块查库
  let componentKeys = [];
  fields.forEach((field) => {
    if (field.type !== 'dynamiczone' || data[field.key] === undefined) return;
    getAllowedComponents(field).forEach((key) => {
      if (componentKeys.indexOf(key) === -1) componentKeys.push(key);
    });
  });
  let componentFieldMap = await loadComponentFieldMap({ componentKeys });

  let dataJson = {};
  for (let i = 0; i < fields.length; i++) {
    let field = fields[i];
    let key = field.key;
    // 系统保留字段由基础字段统一写入，禁止模型同名覆盖
    if (isReservedContentKey(key)) continue;
    if (data[key] === undefined) {
      if (mode === 'add' && field.required) return { code: -1, msg: `字段「${field.title || key}」为必填项` };
      continue;
    }
    if (field.required && isFieldValueEmpty(field, data[key])) {
      return { code: -1, msg: `字段「${field.title || key}」为必填项` };
    }
    if (data[key] === null) {
      dataJson[key] = null;
      continue;
    }
    let valueError = getFieldValueError({ field, value: data[key] });
    if (valueError) return { code: -1, msg: valueError, field: key };
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
/**
 * 权限注意：访问以下链接查看
 * 文档地址：https://vkdoc.fsq.pub/client/uniCloud/cloudfunctions/cloudObject.html#内置权限
 */
const cloudObject = {
  isCloudObject: true, // 标记为云对象模式
  /**
   * 请求前处理，主要用于调用方法之前进行预处理，一般用于拦截器、统一的身份验证、参数校验、定义全局对象等。
   * 文档地址：https://vkdoc.fsq.pub/client/uniCloud/cloudfunctions/cloudObject.html#before-预处理
   */
  _before: async function () {
    vk = this.vk; // 将vk定义为全局对象
    // let { customUtil, uniID, config, pubFun } = this.getUtil(); // 获取工具包
  },
  /**
   * 请求后处理，主要用于处理本次调用方法的返回结果或者抛出的错误
   * 文档地址：https://vkdoc.fsq.pub/client/uniCloud/cloudfunctions/cloudObject.html#after-后处理
   */
  _after: async function (options) {
    let { err, res } = options;
    if (err) {
      if (err instanceof Error) {
        return; // 如果是Error类型，直接return;不处理
      }
      return err;
    }
    return res;
  },
  /**
   * 获取列表
   * @url admin/cms/sys.content.getList 前端调用的url参数地址
   */
  getList: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    const query = data.query || {};
    const { locale, status } = query;

    // 后台列表默认返回全部状态（含未发布/草稿）；双记录模型下同一 document_id 可能出现草稿、已发布两行，
    // 需要只看某一状态时传 query.status（true 已发布 / false 草稿）
    if (status !== undefined && status !== null && typeof status !== 'boolean') {
      return { code: -1, msg: 'status 必须为布尔值' };
    }

    // 前端已明确标记为非草稿箱模型（buildTableConfig 会带 query.draft），直接走原查询路径，避免多查一次模型
    if (query.draft === false) {
      return await getContentListLegacy(data, locale, status);
    }

    // 只有「集合类型 + 开启草稿箱」的模型才需要把草稿/已发布两条记录合并为一行
    const modelKey = (data.formData || {}).model_key;
    const modelInfo = await loadContentListModel(modelKey);
    if (!modelInfo || modelInfo.draft !== true || modelInfo.type !== 'collection') {
      return await getContentListLegacy(data, locale, status);
    }

    // 字段白名单：模型字段 ∩ display_fields，再补齐行操作必需字段
    const modelFields = await loadModelFields({ model_key: modelKey });
    const fieldKeys = buildContentListFieldKeys(modelInfo, modelFields);
    const sortArr = buildContentListSortArr(data.sortRule);

    let andArr = [];
    if (vk.pubfn.isNotNull(locale)) {
      andArr.push({ locale });
    }
    // 分组前必须锁定模型，避免调用方未传 columns 时把其他模型的内容一起聚合进来
    andArr.push({ model_key: modelKey });

    // data 内的 sortRule / lastSortRule / getCount 会覆盖顶层同名参数，聚合路径必须剔除
    let tableData = Object.assign({}, data);
    delete tableData.sortRule;
    delete tableData.lastSortRule;
    delete tableData.getCount;

    let options = {
      dbName: dbName.content,
      data: tableData,
      whereJson: andArr.length > 0 ? _.and(andArr) : {},
      groupJson: buildContentGroupJson(fieldKeys),
      sortArr,
      // 有 groupJson 时 getTableData 默认关闭计数，分页依赖 total，必须显式开启
      getCount: true,
    };

    // status 不能进分组前 match（否则草稿组会整体消失），只能在分组后过滤；
    // 同时必须给非空的 lastSortArr，否则 skip/limit 会提前到过滤之前执行
    if (status === true || status === false) {
      let lastWhereJson = {};
      lastWhereJson[CONTENT_GROUP_KEY_PREFIX + 'status'] = status;
      options.lastWhereJson = lastWhereJson;
      options.lastSortArr = sortArr;
    }

    res = await vk.baseDao.getTableData(options);
    // 分组结果拍平回原始行结构，表格列渲染、编辑跳转、删除（依赖 _id）均无需改动
    res.rows = flattenContentListGroupRows(res.rows, fieldKeys);
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 获取内容详情：支持按 _id 定位单条记录，或按 document_id + locale + status 精确定位草稿/已发布记录
   * @url admin/cms/sys.content.getInfo 前端调用的url参数地址
   */
  getInfo: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    let { _id, document_id, locale, status } = data;

    // 支持两种定位方式：_id 或 document_id + locale + status（status 不传时兼容旧的单条语义）
    if (vk.pubfn.isNull(_id) && vk.pubfn.isNull(document_id)) return { code: -1, msg: '参数错误' };

    let whereJson = {};
    if (vk.pubfn.isNotNull(_id)) {
      whereJson._id = _id;
    } else {
      whereJson.document_id = document_id;
      if (vk.pubfn.isNotNull(locale)) whereJson.locale = locale;
      if (status !== undefined && status !== null) {
        if (typeof status !== 'boolean') return { code: -1, msg: 'status 必须为布尔值' };
        whereJson.status = status;
      }
    }

    res.info = await vk.baseDao.selects({
      dbName: dbName.content,
      getMain: true,
      getOne: true,
      // 主表where条件
      whereJson,
      // 同一 document_id + locale 存在重复数据时，固定返回最新一条
      sortArr: [{ name: '_add_time', type: 'desc' }],
      foreignDB: [
        {
          dbName: dbName.model,
          localKey: 'model_key',
          foreignKey: 'key',
          as: 'model',
          limit: 1,
        },
      ],
    });

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 模板函数
   * @url admin/cms/sys.content.add 前端调用的url参数地址
   */
  add: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    let { model_key, document_id, locale } = data;

    if (vk.pubfn.isNull(model_key) || typeof model_key !== 'string') return { code: -1, msg: '参数错误' };
    // 空语言按未设置处理，保证唯一性校验条件与最终落库数据一致
    if (vk.pubfn.isNull(locale)) locale = undefined;

    // 校验模型存在且允许写入内容
    let modelRes = await getWritableContentModel(model_key);
    if (modelRes.code !== 0) return modelRes;

    // document_id 为空时自动生成
    if (vk.pubfn.isNull(document_id)) {
      document_id = await vk.pubfn.randomAsync(
        24,
        'abcdefghijklmnopqrstuvwxyz0123456789',
        async (val) => {
          let num = await vk.baseDao.count({
            dbName: dbName.content,
            whereJson: {
              document_id: val,
            },
          });
          return num === 0 ? true : false;
        },
        10
      );
    }
    if (vk.pubfn.isNull(document_id)) return { code: -1, msg: 'document_id 生成失败，请重试' };

    // 显式传 status 时尊重传入值（供「保存草稿」使用），未传时默认 true（新增即发布）
    let statusRes = normalizeStatus(data.status, true);
    if (statusRes.code !== 0) return { code: -1, msg: statusRes.msg };

    // (document_id, locale, status) 唯一性校验：同一文档同一语言下草稿与已发布各最多一条
    let existsNum = await vk.baseDao.count({
      dbName: dbName.content,
      whereJson: buildContentUniqueWhere({ document_id, locale, status: statusRes.value }),
    });
    if (existsNum > 0) return { code: -1, msg: '该文档在当前语言和状态下已存在内容，请勿重复新增' };

    // 查询模型字段定义
    let fields = await loadModelFields({ model_key });

    // 按字段定义生成写入白名单，并校验必填与类型
    let buildRes = await buildContentFieldData({ data, modelFields: fields, mode: 'add' });
    if (buildRes.code !== 0) return buildRes;

    // 写入创建人/更新人
    let dataJson = stripUndefined({
      model_key,
      status: statusRes.value,
      document_id,
      locale,
      created_by_id: uid,
      updated_by_id: uid,
    });
    dataJson = Object.assign(dataJson, buildRes.dataJson);

    let id = await vk.baseDao.add({
      dbName: dbName.content,
      dataJson,
    });
    if (vk.pubfn.isNull(id)) return { code: -1, msg: '新增内容失败，请重试' };

    res.id = id;
    // 返回 document_id，供前端新增成功后以 document_id 进入编辑页
    res.document_id = document_id;
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 模板函数
   * @url admin/cms/sys.content.update 前端调用的url参数地址
   */
  update: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid, userInfo } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    let { _id } = data;

    if (vk.pubfn.isNull(_id) || typeof _id !== 'string') return { code: -1, msg: '_id不能为空' };

    // 关键字段（model_key / document_id / locale）一律以库中记录为准，禁止客户端篡改
    let record = await vk.baseDao.select({
      dbName: dbName.content,
      whereJson: { _id },
      getOne: true,
      getMain: true,
    });
    if (!record) return { code: -1, msg: '内容不存在或已删除' };

    // 非超管只能操作自己创建的内容（历史数据无 created_by_id 时放行）
    let scopeRes = checkContentOperateScope({ userInfo, uid, record });
    if (scopeRes) return scopeRes;

    let model_key = record.model_key;

    // status 未传时沿用库中值，传入则必须为布尔值
    let statusRes = normalizeStatus(data.status, record.status);
    if (statusRes.code !== 0) return { code: -1, msg: statusRes.msg };

    // 状态切换时按 (document_id, locale, status) 查重，避免出现第三条同组合记录
    if (statusRes.value !== record.status) {
      let conflictWhere = buildContentUniqueWhere({
        document_id: record.document_id,
        locale: record.locale,
        status: statusRes.value,
      });
      conflictWhere._id = _.neq(_id);
      let conflictNum = await vk.baseDao.count({ dbName: dbName.content, whereJson: conflictWhere });
      if (conflictNum > 0) return { code: -1, msg: '该文档在当前语言和状态下已存在内容' };
    }

    // 查询模型字段定义
    let fields = await loadModelFields({ model_key });

    // 按字段定义生成写入白名单，并校验必填与类型
    let buildRes = await buildContentFieldData({ data, modelFields: fields, mode: 'update' });
    if (buildRes.code !== 0) return buildRes;

    // 剔除 undefined，避免未传字段被驱动写成 null
    let dataJson = stripUndefined({
      status: statusRes.value,
      updated_by_id: uid,
    });
    dataJson = Object.assign(dataJson, buildRes.dataJson);

    let num = await vk.baseDao.update({
      dbName: dbName.content,
      whereJson: {
        _id,
      },
      dataJson,
    });
    // baseDao.update 返回的是「实际修改条数」：内容与库中完全一致时也可能为 0，
    // 不能据此判定记录不存在（否则保存后未改动直接发布会误报「内容不存在或已删除」）
    if (num === 0) {
      let existsNum = await vk.baseDao.count({ dbName: dbName.content, whereJson: { _id } });
      if (existsNum === 0) return { code: -1, msg: '内容不存在或已删除' };
    }

    res.num = num;
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 发布内容：把草稿行复制/覆盖到已发布行（status: true）
   * 传入 document_id + locale，不带 _id，避免把 _id 误当成 document_id 使用
   * @url admin/cms/sys.content.publish 前端调用的url参数地址
   */
  publish: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid, userInfo } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    let { document_id } = data;
    let locale = data.locale;
    if (vk.pubfn.isNull(locale)) locale = undefined;
    if (vk.pubfn.isNull(document_id)) return { code: -1, msg: '参数错误' };

    // 草稿行是发布的唯一数据来源
    let draft = await vk.baseDao.select({
      dbName: dbName.content,
      whereJson: buildContentUniqueWhere({ document_id, locale, status: false }),
      getOne: true,
      getMain: true,
    });
    if (!draft) return { code: -1, msg: '草稿不存在，请先保存草稿' };

    // 非超管只能发布自己创建的内容
    let scopeRes = checkContentOperateScope({ userInfo, uid, record: draft });
    if (scopeRes) return scopeRes;

    // 复制草稿的内容字段到发布行，系统字段单独处理
    let excludeKeys = ['_id', '_openid', '_add_time', '_add_time_str', '_update_time', '_update_time_str', 'status', 'created_by_id', 'updated_by_id', 'user_id'];
    let dataJson = {};
    Object.keys(draft).forEach((key) => {
      if (excludeKeys.indexOf(key) === -1) dataJson[key] = draft[key];
    });
    dataJson.status = true;
    dataJson.updated_by_id = uid;

    let published = await vk.baseDao.select({
      dbName: dbName.content,
      whereJson: buildContentUniqueWhere({ document_id, locale, status: true }),
      getOne: true,
      getMain: true,
    });

    if (published) {
      // 已存在发布行：覆盖更新，不重复插入
      let publishedScopeRes = checkContentOperateScope({ userInfo, uid, record: published });
      if (publishedScopeRes) return publishedScopeRes;
      let num = await vk.baseDao.update({
        dbName: dbName.content,
        whereJson: { _id: published._id },
        dataJson,
      });
      // 同上：草稿内容与已发布内容完全一致时 updated 可能为 0，此时仍视为发布成功
      if (num === 0) {
        let existsNum = await vk.baseDao.count({ dbName: dbName.content, whereJson: { _id: published._id } });
        if (existsNum === 0) return { code: -1, msg: '发布失败，请重试' };
      }
      res.id = published._id;
      res.num = num;
    } else {
      // 首次发布：沿用草稿的创建人，没有则记为当前用户
      dataJson.created_by_id = draft.created_by_id || uid;
      let id = await vk.baseDao.add({
        dbName: dbName.content,
        dataJson,
      });
      if (vk.pubfn.isNull(id)) return { code: -1, msg: '发布失败，请重试' };
      res.id = id;
      res.num = 1;
    }

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 模板函数
   * @url admin/cms/sys.content.delete 前端调用的url参数地址
   */
  delete: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid, userInfo } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    const { _id } = data;

    if (vk.pubfn.isNull(_id) || typeof _id !== 'string') return { code: -1, msg: '_id不能为空' };

    // 先查记录：校验存在性与数据归属
    let record = await vk.baseDao.select({
      dbName: dbName.content,
      whereJson: { _id },
      getOne: true,
      getMain: true,
    });
    if (!record) return { code: -1, msg: '内容不存在或已删除' };

    // 非超管只能操作自己创建的内容（历史数据无 created_by_id 时放行）
    let scopeRes = checkContentOperateScope({ userInfo, uid, record });
    if (scopeRes) return scopeRes;

    let num = await vk.baseDao.deleteById({
      dbName: dbName.content,
      id: _id,
    });
    if (num === 0) return { code: -1, msg: '内容不存在或已删除' };

    res.num = num;
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 供远程下拉等场景使用的只读接口：按模型返回「已发布」内容列表
   * 可见性由接口固定为 status: true，调用方无法通过参数改变，避免未发布内容对外泄露
   * 动态区块字段原样透出块数组，消费端据 __component 逐块渲染，后台不做任何加工与清洗
   * @url admin/cms/sys.content.pubGetContent 前端调用的url参数地址
   */
  pubGetContent: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo();
    // 业务逻辑开始-----------------------------------------------------------
    // 请求体由 vk-data-input-remote-select 直接以 actionData 扁平传入，不能再取 data.data
    let { model_key } = data;

    // 只接受 true 或不传；其它值（含历史调用方传的 'all'）直接拒绝，避免误以为可以改变可见性
    if (data.status !== undefined && data.status !== null && data.status !== true) {
      return { code: -1, msg: 'pubGetContent 仅返回已发布内容，不支持自定义 status' };
    }

    if (vk.pubfn.isNull(model_key)) return { code: -1, msg: '参数错误' };

    // 分页参数：默认取前 100 条，允许调用方指定，最大 500
    let pageIndex = Number(data.pageIndex) > 0 ? Number(data.pageIndex) : 1;
    let pageSize = Number(data.pageSize) > 0 ? Math.min(Number(data.pageSize), 500) : 100;

    // 该模型的动态区块字段（仅这些字段需要额外透出块数组，其余字段维持 value/label 契约不变）
    let fieldRes = await vk.baseDao.select({
      dbName: dbName.modelField,
      whereJson: {
        model_key,
        type: 'dynamiczone',
      },
    });
    let dynamicZoneKeys = (fieldRes.rows || []).map((f) => f.key);

    // 字段白名单：只返回下拉需要的字段，避免 content 等大字段
    let fieldJson = { _id: true, title: true };
    dynamicZoneKeys.forEach((key) => {
      fieldJson[key] = true;
    });

    let selectRes = await vk.baseDao.selects({
      dbName: dbName.content,
      pageIndex,
      pageSize,
      whereJson: {
        model_key,
        // 固定过滤：无论调用方传什么，都只返回已发布内容
        status: true,
      },
      fieldJson,
    });

    let list = [];
    for (let i in selectRes.rows) {
      let item = selectRes.rows[i];
      let value = item._id;
      let label = item.title;
      let option = { value: value, label: label };
      dynamicZoneKeys.forEach((key) => {
        if (item[key] !== undefined) option[key] = item[key];
      });
      list.push(option);
    }
    res.list = list;
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 后台关联字段专用选项接口：按模型返回草稿 + 已发布内容，供关联选择使用
   * 与 pubGetContent（固定只返回已发布）不同，本接口仅在后台登录态下使用，可见草稿
   * 双记录模型下同一 document_id 会同时存在草稿行与发布行，按 document_id 去重后只返回一个选项；
   * 选项的 label / value 字段由调用方按字段配置传入，未配置时使用默认规则（见下）
   * @url admin/cms/sys.content.getRelationOptions 前端调用的url参数地址
   */
  getRelationOptions: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo();
    // 业务逻辑开始-----------------------------------------------------------
    let { model_key } = data;

    if (vk.pubfn.isNull(model_key)) return { code: -1, msg: '参数错误' };

    // 分页参数：默认取前 500 条原始行，允许调用方指定，最大 500
    let pageIndex = Number(data.pageIndex) > 0 ? Number(data.pageIndex) : 1;
    let pageSize = Number(data.pageSize) > 0 ? Math.min(Number(data.pageSize), 500) : 500;

    // 该模型全部字段定义：既用于透出动态区块，也作为 label / value 字段名的白名单来源
    let fieldRes = await vk.baseDao.select({
      dbName: dbName.modelField,
      pageSize: -1,
      whereJson: { model_key },
    });
    let modelFields = fieldRes.rows || [];
    let dynamicZoneKeys = modelFields.filter((f) => f.type === 'dynamiczone').map((f) => f.key);

    // 选项字段白名单：内容系统字段 + 当前模型已定义字段，禁止把任意字段名拼进查询
    let optionKeyWhitelist = ['_id', 'document_id', 'title', 'status', 'locale', '_add_time'];
    modelFields.forEach((f) => {
      if (optionKeyWhitelist.indexOf(f.key) === -1) optionKeyWhitelist.push(f.key);
    });

    // 默认规则：label 优先 title（模型无 title 字段时回退 _id）；value 回退 _id
    let hasTitleField = modelFields.some((f) => f.key === 'title');
    let labelKey = vk.pubfn.isNotNull(data.label) ? data.label : hasTitleField ? 'title' : '_id';
    let valueKey = vk.pubfn.isNotNull(data.value) ? data.value : '_id';

    if (typeof labelKey !== 'string' || optionKeyWhitelist.indexOf(labelKey) === -1) {
      return { code: -1, msg: `关联显示字段「${labelKey}」不在允许范围内` };
    }
    if (typeof valueKey !== 'string' || optionKeyWhitelist.indexOf(valueKey) === -1) {
      return { code: -1, msg: `关联取值字段「${valueKey}」不在允许范围内` };
    }

    // 字段白名单：去重所需的 document_id / status，以及配置的 label / value 字段
    let fieldJson = { _id: true, document_id: true, status: true };
    fieldJson[labelKey] = true;
    fieldJson[valueKey] = true;
    dynamicZoneKeys.forEach((key) => {
      fieldJson[key] = true;
    });

    let selectRes = await vk.baseDao.selects({
      dbName: dbName.content,
      pageIndex,
      pageSize,
      // 后台选项不做 status 过滤：草稿也要能被关联选中
      whereJson: { model_key },
      fieldJson,
      sortArr: [{ name: '_add_time', type: 'desc' }],
    });

    // 按 document_id 合并草稿/发布两行；已发布行优先作为展示行
    let optionMap = {};
    let optionOrder = [];
    (selectRes.rows || []).forEach((item) => {
      let dedupeKey = item.document_id || item._id;
      let existing = optionMap[dedupeKey];
      // 已存在选项时，仅当当前行为已发布行才覆盖（发布行是逻辑文档的对外权威版本）
      if (existing && item.status !== true) return;
      // 配置字段为空或不存在时回退 _id，保证选项始终可展示、可选中
      let label = vk.pubfn.isNull(item[labelKey]) ? item._id : item[labelKey];
      let value = vk.pubfn.isNull(item[valueKey]) ? item._id : item[valueKey];
      let option = { value: value, label: label };
      dynamicZoneKeys.forEach((key) => {
        if (item[key] !== undefined) option[key] = item[key];
      });
      optionMap[dedupeKey] = option;
      if (!existing) optionOrder.push(dedupeKey);
    });

    res.list = optionOrder.map((dedupeKey) => optionMap[dedupeKey]);
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
};

module.exports = cloudObject;
