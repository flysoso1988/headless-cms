'use strict';
let vk = uniCloud.vk; // 全局vk实例
// 涉及的表名
const dbName = require('../../../dao/config.js');

const db = uniCloud.database(); // 全局数据库引用
const _ = db.command; // 数据库操作符
const $ = _.aggregate; // 聚合查询操作符
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
      getOne:true,
      // 主表where条件
      whereJson,
      foreignDB: [
        {
          dbName: dbName.model,
          localKey: 'model_id',
          foreignKey: '_id',
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
    let { model_id, status, document_id, locale } = data;

    if (vk.pubfn.isNull(model_id)) return { code: -1, msg: '参数错误' };

    // document_id 为空时自动生成，用于后续国际化版本关联
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
    let dataJson = { model_id, status, document_id, locale };
    // if (!vk.pubfn.isNull(locale)) dataJson.locale = locale;

    // 查询模型字段定义
    let fields = await vk.baseDao.selects({
      dbName: dbName.modelField,
      getMain: true,
      pageIndex: 1,
      pageSize: -1,
      // 主表where条件
      whereJson: { model_id },
    });

    let allowedKeys = vk.pubfn.arrayObjectGetArray(fields, 'key');

    allowedKeys.forEach((key) => {
      if (data[key] !== undefined) {
        dataJson[key] = data[key];
      }
    });

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
    let { _id, model_id, status, document_id, locale } = data;

    if (vk.pubfn.isNullOne({ _id, model_id, document_id })) return { code: -1, msg: '参数错误' };

    // 只提取基础字段和模型定义的动态字段
    let dataJson = { model_id, status, document_id, locale };
    // if (!vk.pubfn.isNull(locale)) dataJson.locale = locale;

    // 查询模型字段定义
    let fields = await vk.baseDao.selects({
      dbName: dbName.modelField,
      getMain: true,
      pageIndex: 1,
      pageSize: -1,
      // 主表where条件
      whereJson: { model_id },
    });

    let allowedKeys = vk.pubfn.arrayObjectGetArray(fields, 'key');

    allowedKeys.forEach((key) => {
      if (data[key] !== undefined) {
        dataJson[key] = data[key];
      }
    });

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
        _id:_.exists(true)
      }
    });
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
};

module.exports = cloudObject;
