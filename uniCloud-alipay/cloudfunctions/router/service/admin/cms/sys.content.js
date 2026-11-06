'use strict';
let vk = uniCloud.vk; // 全局vk实例
// 涉及的表名
const dbName = require('../../../dao/config.js');

const db = uniCloud.database(); // 全局数据库引用
const _ = db.command; // 数据库操作符
const $ = _.aggregate; // 聚合查询操作符

/* ============ 内容写入共用逻辑（字段白名单 + 动态区块校验） ============ */

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
 * 根据模型字段定义构建内容写入数据
 */
async function buildContentFieldData({ data = {}, modelFields = [] }) {
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
    const { draft, locale } = data.query || {};

    let andArr = [];
    if (vk.pubfn.isNotNull(locale)) {
      andArr.push({ locale });
    }
    // if (vk.pubfn.isNotNull(draft)) {
    //   andArr.push({ publish_time: _.exists(!draft) });
    // }

    res = await vk.baseDao.getTableData({
      dbName: dbName.content,
      data,
      whereJson: andArr.length > 0 ? _.and(andArr) : {},
    });
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 获取内容详情，多语言内容通过 document_id + locale 定位唯一语言的版本
   * @url admin/cms/sys.content.getInfo 前端调用的url参数地址
   */
  getInfo: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    let { document_id, locale } = data;

    if (vk.pubfn.isNull(document_id)) return { code: -1, msg: '参数错误' };

    let whereJson = { document_id };
    if (vk.pubfn.isNotNull(locale)) whereJson.locale = locale;

    res.info = await vk.baseDao.selects({
      dbName: dbName.content,
      getMain: true,
      getOne: true,
      // 主表where条件
      whereJson,
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
    let { model_key, status=true, document_id, locale } = data;

    if (vk.pubfn.isNull(model_key)) return { code: -1, msg: '参数错误' };

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

    // 只提取基础字段和模型定义的动态字段
    let dataJson = { model_key, status, document_id, locale };
    // if (!vk.pubfn.isNull(locale)) dataJson.locale = locale;

    // 查询模型字段定义
    let fields = await vk.baseDao.selects({
      dbName: dbName.modelField,
      getMain: true,
      pageIndex: 1,
      pageSize: -1,
      // 主表where条件
      whereJson: { model_key },
    });

    // 按字段定义生成写入白名单，并对动态区块做递归一层校验
    // getMain 为 true 时 selects 直接返回字段数组
    let buildRes = await buildContentFieldData({ data, modelFields: fields });
    if (buildRes.code !== 0) return buildRes;
    dataJson = Object.assign(dataJson, buildRes.dataJson);

    let id = await vk.baseDao.add({
      dbName: dbName.content,
      dataJson,
    });

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 模板函数
   * @url admin/cms/sys.content.update 前端调用的url参数地址
   */
  update: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    let { _id, model_key, status, document_id, locale } = data;

    if (vk.pubfn.isNullOne({ _id, model_key, document_id })) return { code: -1, msg: '参数错误' };

    // 只提取基础字段和模型定义的动态字段
    let dataJson = { model_key, status, document_id, locale };
    // if (!vk.pubfn.isNull(locale)) dataJson.locale = locale;

    // 查询模型字段定义
    let fields = await vk.baseDao.selects({
      dbName: dbName.modelField,
      getMain: true,
      pageIndex: 1,
      pageSize: -1,
      // 主表where条件
      whereJson: { model_key },
    });

    // 按字段定义生成写入白名单，并对动态区块做递归一层校验
    // getMain 为 true 时 selects 直接返回字段数组
    let buildRes = await buildContentFieldData({ data, modelFields: fields });
    if (buildRes.code !== 0) return buildRes;
    dataJson = Object.assign(dataJson, buildRes.dataJson);

    let num = await vk.baseDao.update({
      dbName: dbName.content,
      whereJson: {
        _id,
      },
      dataJson,
    });

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 模板函数
   * @url admin/cms/sys.content.delete 前端调用的url参数地址
   */
  delete: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    const { _id } = data;

    if (vk.pubfn.isNull(_id)) return { code: -1, msg: '参数错误' };

    let num = await vk.baseDao.deleteById({
      dbName: dbName.content,
      id: _id,
    });

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 模板函数
   * @url admin/cms/sys.content.test 前端调用的url参数地址
   */
  test: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    let num = await vk.baseDao.del({
      dbName: dbName.content,
      whereJson: {
        _id: _.exists(true),
      },
    });
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
    let { data: paramData = {} } = data;
    let { model_key } = paramData;

    // 该模型的动态区块字段（仅这些字段需要额外透出块数组，其余字段维持 value/label 契约不变）
    let fieldRes = await vk.baseDao.select({
      dbName: dbName.modelField,
      whereJson: {
        model_key,
        type: 'dynamiczone',
      },
    });
    let dynamicZoneKeys = (fieldRes.rows || []).map((f) => f.key);

    let selectRes = await vk.baseDao.selects({
      dbName: dbName.content,
      whereJson: {
        model_key,
      },
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
    return res;
    // 业务逻辑结束-----------------------------------------------------------
  },
};

module.exports = cloudObject;
