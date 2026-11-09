'use strict';
let vk = uniCloud.vk; // 全局vk实例
// 涉及的表名
const dbName = require('../../../dao/config.js');

const db = uniCloud.database(); // 全局数据库引用
const _ = db.command; // 数据库操作符
const $ = _.aggregate; // 聚合查询操作符
const DAY_MS = 24 * 60 * 60 * 1000;
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
   * @url admin/setting/sys.apiToken.getList 前端调用的url参数地址
   */
  getList: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    res = await vk.baseDao.getTableData({
      dbName: dbName.apiTokens,
      data,
      // 令牌属于敏感字段，不在列表中返回
      fieldJson: { token: false },
      whereJson: {},
      sortArr: [{ name: '_add_time', type: 'desc' }],
    });
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 获取模型列表（用于模型权限选择）
   * @url admin/setting/sys.apiToken.getModels 前端调用的url参数地址
   */
  getModels: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    const rows = await vk.baseDao.select({
      dbName: dbName.model,
      getCount: false,
      getMain: true,
      pageIndex: 1,
      pageSize: -1,
      whereJson: {},
      fieldJson: { key: true, name: true },
      sortArr: [{ name: 'key', type: 'asc' }],
    });

    let list = [];
    for (let i in rows) {
      let item = rows[i];
      list.push({
        value: item.key,
        label: item.name,
        key: item.key,
        name: item.name,
      });
    }

    res.list = list;
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 添加令牌
   * @url admin/setting/sys.apiToken.add 前端调用的url参数地址
   */
  add: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    let { name, description = '', token_duration = 0, token_type = 'read-only', model_permissions = [] } = data;

    name = typeof name === 'string' ? name.trim() : '';
    if (vk.pubfn.isNull(name)) return { code: -1, msg: '名称不能为空' };

    let duration = Number(token_duration);
    if (!Number.isFinite(duration) || duration < 0) duration = 0;
    let permissions = token_type === 'custom' && Array.isArray(model_permissions) ? model_permissions : [];
    let addTime = Date.now();

    res.id = await vk.baseDao.add({
      dbName: dbName.apiTokens,
      dataJson: {
        name,
        description,
        token: `vk_${vk.pubfn.random(64, 'abcdefghijklmnopqrstuvwxyz0123456789')}`,
        token_duration: duration,
        token_type,
        model_permissions: permissions,
        expire_time: duration > 0 ? addTime + duration * DAY_MS : null,
      },
    });

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 修改令牌
   * @url admin/setting/sys.apiToken.update 前端调用的url参数地址
   */
  update: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    let { _id, name, description = '', token_duration = 0, token_type = 'read-only', model_permissions = [] } = data;

    if (vk.pubfn.isNull(_id)) return { code: -1, msg: '_id不能为空' };
    name = typeof name === 'string' ? name.trim() : '';
    if (vk.pubfn.isNull(name)) return { code: -1, msg: '名称不能为空' };

    let info = await vk.baseDao.findByWhereJson({
      dbName: dbName.apiTokens,
      whereJson: { _id },
    });
    if (!info) return { code: -1, msg: '要修改的令牌不存在' };

    let duration = Number(token_duration);
    if (!Number.isFinite(duration) || duration < 0) duration = 0;
    let permissions = token_type === 'custom' && Array.isArray(model_permissions) ? model_permissions : [];
    // 有效期以创建时间为基准计算过期时间
    let addTime = info._add_time || Date.now();

    res.num = await vk.baseDao.updateById({
      dbName: dbName.apiTokens,
      id: _id,
      dataJson: {
        name,
        description,
        token_duration: duration,
        token_type,
        model_permissions: permissions,
        expire_time: duration > 0 ? addTime + duration * DAY_MS : null,
      },
    });

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 删除令牌
   * @url admin/setting/sys.apiToken.delete 前端调用的url参数地址
   */
  delete: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    const { _id } = data;

    if (vk.pubfn.isNull(_id)) return { code: -1, msg: '_id不能为空' };

    res.num = await vk.baseDao.deleteById({
      dbName: dbName.apiTokens,
      id: _id,
    });

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
};

module.exports = cloudObject;
