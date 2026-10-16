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
   * @url admin/cms/sys.field.getList 前端调用的url参数地址
   */
  getList: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 模板函数
   * @url admin/cms/sys.field.add 前端调用的url参数地址
   */
  add: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    const { title, key, type, model_id, data: options, fileType, multiple, multipleLimit, default_value, condition, required, sort, relation } = data;

    let num = await vk.baseDao.count({
      dbName: dbName.modelField,
      whereJson: {
        model_id,
        key,
      },
    });

    if (num > 0) return { code: -1, msg: `${key}字段已存在，不能重复添加` };

    res.id = await vk.baseDao.add({
      dbName: dbName.modelField,
      dataJson: {
        title,
        key,
        type,
        model_id,
        data: options,
        fileType,
        multiple,
        multipleLimit,
        default_value,
        condition,
        required,
        sort,
        relation,
      },
    });
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 模板函数
   * @url admin/cms/sys.field.update 前端调用的url参数地址
   */ update: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    let { _id, title, type, model_id, data: options, fileType, multiple, multipleLimit, default_value, condition, required, sort, relation } = data;

    if (vk.pubfn.isNullOne(_id)) {
      return { code: -1, msg: '_id不能为空' };
    }

    await vk.baseDao.updateById({
      dbName: dbName.modelField,
      id: _id,
      dataJson: {
        title,
        type,
        model_id,
        data: options,
        fileType,
        multiple,
        multipleLimit,
        default_value,
        condition,
        required,
        sort,
        relation,
      },
    });
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 模板函数
   * @url admin/cms/sys.field.delete 前端调用的url参数地址
   */
  delete: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    let { _id } = data;

    if (vk.pubfn.isNull(_id)) {
      return { code: -1, msg: '_id不能为空' };
    }

    await vk.baseDao.deleteById({
      dbName:dbName.modelField,
      id: _id,
    });

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 模板函数
   * @url admin/cms/sys.field.sort 前端调用的url参数地址
   */
  sort: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    let { ids } = data;

    if (vk.pubfn.isNull(ids)) return { code: -1, msg: 'ids不能为空' };

    for (let i = 0; i < ids.length; i++) {
      await vk.baseDao.updateById({
        dbName,
        id: ids[i],
        dataJson: { sort: i },
      });
    }
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
};

module.exports = cloudObject;
