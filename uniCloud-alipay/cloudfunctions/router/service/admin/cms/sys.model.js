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
   * @url admin/cms/sys.model.getList 前端调用的url参数地址
   */
  getList: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    res = await vk.baseDao.selects({
      dbName: dbName.model,
      pageSize: -1,
      whereJson: {},
      sortArr: [{ name: 'key', type: 'asc' }],
      foreignDB: [
        {
          dbName: dbName.modelField,
          localKey: '_id',
          foreignKey: 'model_id',
          as: 'fields',
          sortArr: [{ name: 'sort', type: 'asc' }],
          limit: 500,
        },
      ],
    });
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 获取详情
   * @url admin/cms/sys.model.getInfo 前端调用的url参数地址
   */
  getInfo: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    const { id } = data;
    res.info = await vk.baseDao.selects({
      dbName: dbName.model,
      getCount: false,
      getMain: true,
      getOne: true,
      // 主表where条件
      whereJson: {
        _id: id,
      },
      // 主表字段显示规则
      fieldJson: {},
      // 主表排序规则
      sortArr: [{ name: '_id', type: 'desc' }],
      // 副表列表
      foreignDB: [
        {
          dbName: dbName.modelField,
          localKey: '_id',
          foreignKey: 'model_id',
          as: 'fields',
        },
      ],
    });
    console.log(res.info);
    if (!res.info) return { code: -1, msg: '请求错误' };
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 添加模型
   * @url admin/cms/sys.model.add 前端调用的url参数地址
   */
  add: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    let { name, key, type, status = true, draft = false, internationalization = false, display_fields = [] } = data;

    res.id = await vk.baseDao.add({
      dbName: 'vk-cms-model',
      dataJson: {
        name,
        key,
        type,
        status,
        draft,
        internationalization,
        display_fields,
      },
    });
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 模板函数
   * @url admin/cms/sys.model.update 前端调用的url参数地址
   */
  update: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    let { _id, name, key, type, status = true, draft = false, internationalization = false, display_fields = [] } = data;

    if (vk.pubfn.isNullOne(_id)) {
      return { code: -1, msg: '_id不能为空' };
    }

    await vk.baseDao.updateById({
      dbName: 'vk-cms-model',
      id: _id,
      dataJson: {
        name,
        key,
        type,
        status,
        draft,
        internationalization,
        display_fields,
      },
    });

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 删除模型
   * @url admin/cms/sys.model.delete 前端调用的url参数地址
   */
  delete: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    const { _id } = data;

    let num = await vk.baseDao.deleteById({
      dbName: dbName.model,
      id: _id,
    });
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 模板函数
   * @url admin/cms/sys.model.test 前端调用的url参数地址
   */
  test: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
};

module.exports = cloudObject;
