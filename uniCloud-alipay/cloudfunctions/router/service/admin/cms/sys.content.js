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
  if (type === 'date' || type === 'datetime') {
    return typeof value === 'string' || typeof value === 'number' ? null : `字段「${title}」必须为日期字符串或时间戳`;
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
    const { locale, status } = data.query || {};

    let andArr = [];
    if (vk.pubfn.isNotNull(locale)) {
      andArr.push({ locale });
    }
    // 后台列表默认返回全部状态（含未发布/草稿）；双记录模型下同一 document_id 可能出现草稿、已发布两行，
    // 需要只看某一状态时传 query.status（true 已发布 / false 草稿）
    if (status !== undefined && status !== null) {
      if (typeof status !== 'boolean') return { code: -1, msg: 'status 必须为布尔值' };
      andArr.push({ status });
    }

    res = await vk.baseDao.getTableData({
      dbName: dbName.content,
      data,
      whereJson: andArr.length > 0 ? _.and(andArr) : {},
    });
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
   * 供远程下拉等场景使用的公开只读接口：按模型返回内容列表
   * 动态区块字段原样透出块数组，消费端据 __component 逐块渲染，后台不做任何加工与清洗
   * @url admin/cms/sys.content.pubGetContent 前端调用的url参数地址
   */
  pubGetContent: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo();
    // 业务逻辑开始-----------------------------------------------------------
    let paramData = data.data || {};
    let { model_key } = paramData;

    if (vk.pubfn.isNull(model_key)) return { code: -1, msg: '参数错误' };

    // 分页参数：默认取前 100 条，允许调用方指定，最大 500
    let pageIndex = Number(paramData.pageIndex) > 0 ? Number(paramData.pageIndex) : 1;
    let pageSize = Number(paramData.pageSize) > 0 ? Math.min(Number(paramData.pageSize), 500) : 100;

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
};

module.exports = cloudObject;
