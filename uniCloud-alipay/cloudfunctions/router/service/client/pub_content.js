'use strict';
let vk = uniCloud.vk;
const dbName = require('../../dao/config.js');

const db = uniCloud.database();
const _ = db.command;
const $ = _.aggregate;

/**
 * 前台公开内容查询云对象（Strapi 风格 REST API）
 * 无需登录即可访问，用于前端获取CMS内容数据
 * 支持 URL 化访问：
 *   - GET /http/router/content/{model_key} 获取内容列表
 *   - GET /http/router/content/{model_key}/{document_id} 获取内容详情
 *
 * 查询参数（兼容 Strapi 风格）：
 *   - locale: 语言代码（如 'zh-Hans'、'en'）
 *   - sort: 排序（如 'publish_time:desc' 或 '-publish_time'）
 *   - filters: 过滤条件（如 filters[title][$contains]=关键词）
 *   - pagination[page]: 页码（默认1）
 *   - pagination[pageSize]: 每页数量（默认10）
 *   - fields: 返回字段（逗号分隔，如 'title,summary,cover'）
 *   - populate: 关联查询（'*' 表示关联模型，或指定字段名）
 *   - status: 发布状态（'published' 或 'draft'，默认 'published'）
 */
const cloudObject = {
  isCloudObject: true,

  _before: async function () {
    vk = this.vk;
  },

  _after: async function (options) {
    let { err, res } = options;
    if (err) {
      if (err instanceof Error) {
        return;
      }
      return err;
    }
    return res;
  },

  /**
   * 解析 Strapi 风格的排序参数
   * @param {String|Array} sort 排序参数
   * @returns {Array} 排序数组
   */
  _parseSort(sort) {
    if (!sort) {
      return [{ name: 'publish_time', type: 'desc' }];
    }

    const sortArr = Array.isArray(sort) ? sort : [sort];
    const result = [];

    for (const item of sortArr) {
      if (typeof item !== 'string') continue;

      // 支持 'field:asc' 或 'field:desc' 格式
      if (item.includes(':')) {
        const [field, direction] = item.split(':');
        result.push({ name: field, type: direction.toLowerCase() });
      }
      // 支持 '-field' 格式（降序）
      else if (item.startsWith('-')) {
        result.push({ name: item.slice(1), type: 'desc' });
      }
      // 默认升序
      else {
        result.push({ name: item, type: 'asc' });
      }
    }

    return result.length > 0 ? result : [{ name: 'publish_time', type: 'desc' }];
  },

  /**
   * 解析 Strapi 风格的过滤条件
   * @param {Object} filters 过滤参数
   * @param {String} model_key 模型标识
   * @param {String} locale 语言代码
   * @param {String} status 发布状态
   * @returns {Object} 查询条件
   */
  _parseFilters(filters, model_key, locale, status) {
    const andArr = [{ model_key }];

    // 发布状态过滤
    if (status === 'preview') {
      // 预览模式：不过滤状态
    } else {
      // 默认：只返回已发布内容
      andArr.push({ status: true });
    }

    // 语言过滤
    if (vk.pubfn.isNotNull(locale)) {
      andArr.push({ locale });
    }

    // 处理自定义过滤条件
    if (filters && typeof filters === 'object') {
      for (const [field, condition] of Object.entries(filters)) {
        if (typeof condition === 'object') {
          // 处理操作符条件，如 { $contains: 'xxx' }
          for (const [operator, value] of Object.entries(condition)) {
            switch (operator) {
              case '$eq':
                andArr.push({ [field]: value });
                break;
              case '$ne':
                andArr.push({ [field]: _.neq(value) });
                break;
              case '$contains':
                andArr.push({ [field]: new RegExp(value, 'i') });
                break;
              case '$notContains':
                andArr.push({ [field]: _.not(new RegExp(value, 'i')) });
                break;
              case '$in':
                andArr.push({ [field]: _.in(Array.isArray(value) ? value : [value]) });
                break;
              case '$notIn':
                andArr.push({ [field]: _.nin(Array.isArray(value) ? value : [value]) });
                break;
              case '$gt':
                andArr.push({ [field]: _.gt(value) });
                break;
              case '$gte':
                andArr.push({ [field]: _.gte(value) });
                break;
              case '$lt':
                andArr.push({ [field]: _.lt(value) });
                break;
              case '$lte':
                andArr.push({ [field]: _.lte(value) });
                break;
              case '$null':
                andArr.push({ [field]: value ? null : _.neq(null) });
                break;
              case '$notNull':
                andArr.push({ [field]: _.exists(true) });
                break;
            }
          }
        } else {
          // 直接等值匹配
          andArr.push({ [field]: condition });
        }
      }
    }

    return andArr.length > 0 ? _.and(andArr) : {};
  },

  /**
   * 解析字段选择
   * @param {String|Array} fields 字段参数
   * @returns {Object} 字段映射对象
   */
  _parseFields(fields) {
    if (!fields) {
      return null;
    }

    const fieldArr = Array.isArray(fields) ? fields : fields.split(',').map((f) => f.trim());

    if (fieldArr.length === 0) {
      return null;
    }

    // 构建字段选择对象（true 表示包含）
    const fieldJson = {};
    for (const field of fieldArr) {
      if (field) {
        fieldJson[field] = true;
      }
    }

    return Object.keys(fieldJson).length > 0 ? fieldJson : null;
  },

  /**
   * 构建关联查询
   * @param {String|Array|Object} populate 关联参数
   * @returns {Array} 关联查询数组
   */
  _parsePopulate(populate) {
    if (!populate) {
      return [];
    }

    const foreignDB = [];

    // populate=* 表示关联所有可能的字段（这里默认关联模型表）
    if (populate === '*') {
      foreignDB.push({
        dbName: dbName.model,
        localKey: 'model_key',
        foreignKey: 'key',
        as: 'model',
        limit: 1,
      });
      return foreignDB;
    }

    // populate=model 或 populate[model]=true 格式
    if (typeof populate === 'string') {
      if (populate === 'model') {
        foreignDB.push({
          dbName: dbName.model,
          localKey: 'model_key',
          foreignKey: 'key',
          as: 'model',
          limit: 1,
        });
      }
    } else if (typeof populate === 'object') {
      if (populate.model) {
        foreignDB.push({
          dbName: dbName.model,
          localKey: 'model_key',
          foreignKey: 'key',
          as: 'model',
          limit: 1,
        });
      }
    }

    return foreignDB;
  },

  /**
   * 获取公开内容列表（Strapi 风格）
   * @url client/pub_content.getList
   * @param {Object} data 请求参数
   * @param {String} data.model_key 模型标识（必填，如 'article'、'page'）
   * @param {String} [data.locale] 语言代码
   * @param {String|Array} [data.sort] 排序（如 'publish_time:desc' 或 '-publish_time'）
   * @param {Object} [data.filters] 过滤条件
   * @param {String} [data.keyword] 搜索关键词（兼容旧版）
   * @param {Object} [data.pagination] 分页参数 { page, pageSize }
   * @param {Number} [data.pagination.page=1] 页码
   * @param {Number} [data.pagination.pageSize=10] 每页数量
   * @param {String|Array} [data.fields] 返回字段
   * @param {String|Object} [data.populate] 关联查询
   * @param {String} [data.status='published'] 发布状态（'published' 或 'preview'）
   * @returns {Object} Strapi 风格响应 { data, meta }
   */
  getList: async function (data) {
    let { model_key, locale, sort, filters, keyword, pagination, page = 1, size = 10, fields, populate, status = 'published' } = data;
    console.log('data:', data);
    // 参数校验
    if (vk.pubfn.isNull(model_key)) return { code: -1, msg: '参数错误' };

    // 解析排序
    const sortArr = this._parseSort(sort);

    // 解析过滤条件
    let whereJson = this._parseFilters(filters, model_key, locale, status);

    // 兼容旧版 keyword 搜索
    if (vk.pubfn.isNotNull(keyword)) {
      const keywordCondition = { title: new RegExp(keyword, 'i') };
      whereJson = _.and([whereJson, keywordCondition]);
    }

    // 解析字段选择
    const fieldJson = this._parseFields(fields);

    // 执行查询
    const queryOptions = {
      dbName: dbName.content,
      getCount: true,
      pageIndex: page,
      pageSize: size,
      whereJson,
      sortArr,
    };

    if (fieldJson) {
      queryOptions.fieldJson = fieldJson;
    } else {
      // 默认排除 content 大字段
      queryOptions.fieldJson = { content: false };
    }

    return await vk.baseDao.selects(queryOptions);
  },

  /**
   * 获取内容详情（Strapi 风格）
   * @url client/pub_content.getInfo
   * @param {Object} data 请求参数
   * @param {String} data.document_id 内容文档ID（必填）
   * @param {String} [data.model_key] 模型标识（可选，用于验证）
   * @param {String} [data.locale] 语言代码
   * @param {String|Array} [data.fields] 返回字段
   * @param {String|Object} [data.populate] 关联查询
   * @param {String} [data.status='published'] 发布状态
   * @returns {Object} Strapi 风格响应 { data, meta }
   */
  getInfo: async function (data) {
    let { document_id, model_key, locale, fields, populate, status = 'published' } = data;

    // 参数校验
    if (vk.pubfn.isNull(document_id)) {
      return { code: -1, msg: '缺少必填参数：document_id', data: null, meta: {} };
    }

    // 构建查询条件
    const andArr = [{ document_id }];

    // 发布状态过滤
    if (status !== 'preview') {
      andArr.push({ status: true });
    }

    // 模型验证
    if (vk.pubfn.isNotNull(model_key)) {
      andArr.push({ model_key });
    }

    // 语言过滤
    if (vk.pubfn.isNotNull(locale)) {
      andArr.push({ locale });
    }

    const whereJson = andArr.length > 1 ? _.and(andArr) : { document_id };

    // 解析字段选择
    const fieldJson = this._parseFields(fields);

    // 解析关联查询
    const foreignDB = this._parsePopulate(populate);

    // 执行查询
    const queryOptions = {
      dbName: dbName.content,
      getOne: true,
      getMain: true,
      whereJson,
    };

    if (fieldJson) {
      queryOptions.fieldJson = fieldJson;
    } else {
      queryOptions.fieldJson = {};
    }

    if (foreignDB.length > 0) {
      queryOptions.foreignDB = foreignDB;
    }

    const info = await vk.baseDao.selects(queryOptions);

    // 未找到内容
    if (!info || !info._id) {
      return { code: -1, msg: '内容不存在或已下架', data: null, meta: {} };
    }

    // 构建 Strapi 风格响应
    return {
      code: 0,
      msg: '',
      data: {
        _id: info._id,
        document_id: info.document_id,
        attributes: info,
      },
      meta: {},
    };
  },

  /**
   * 向后兼容：旧版列表接口格式
   * @deprecated 请使用 getList（Strapi 风格）
   */
  getListLegacy: async function (data) {
    const result = await this.getList(data);
    // 转换为旧版格式
    return {
      code: result.code,
      msg: result.msg,
      ...result,
      items: result.data,
      pageIndex: result.meta.pagination?.page,
      pageSize: result.meta.pagination?.pageSize,
      count: result.meta.pagination?.total,
      pageCount: result.meta.pagination?.pageCount,
    };
  },

  /**
   * 向后兼容：旧版详情接口格式
   * @deprecated 请使用 getInfo（Strapi 风格）
   */
  getInfoLegacy: async function (data) {
    const result = await this.getInfo(data);
    if (result.code !== 0) {
      return result;
    }
    // 转换为旧版格式
    return {
      code: result.code,
      msg: result.msg,
      info: result.data.attributes,
    };
  },
};

module.exports = cloudObject;
