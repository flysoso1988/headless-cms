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
   * @url admin/setting/sys.i18n.getList 前端调用的url参数地址
   */
  getList: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    res = await vk.baseDao.getTableData({
      dbName: dbName.settingI18n,
      data,
      // 强制where条件
      whereJson: {},
      sortArr: [{ name: 'sort', type: 'asc' }],
    });
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 模板函数
   * @url admin/setting/sys.i18n.add 前端调用的url参数地址
   */
  add: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    const { name, locale, is_default = false, sort } = data;
    let sortNum = Number(sort);
    if (!Number.isFinite(sortNum)) sortNum = 1000;
    let num = await vk.baseDao.count({
      dbName: dbName.settingI18n,
      whereJson: {
        locale,
      },
    });
    if (num > 0) return { code: 0, msg: '重复' };

    // 只允许存在一个默认语言
    if (is_default) {
      await vk.baseDao.update({
        dbName: dbName.settingI18n,
        whereJson: {
          is_default: true,
        },
        dataJson: {
          is_default: false,
        },
      });
    }

    res.id = await vk.baseDao.add({
      dbName: dbName.settingI18n,
      dataJson: {
        name,
        locale,
        is_default,
        sort: sortNum,
      },
    });

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 模板函数
   * @url admin/setting/sys.i18n.update 前端调用的url参数地址
   */
  update: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    const { _id, name, locale, is_default = false, sort } = data;
    let sortNum = Number(sort);
    if (!Number.isFinite(sortNum)) sortNum = 1000;

    if (vk.pubfn.isNull(_id)) return { code: -1, msg: '_id不能为空' };

    // 只允许存在一个默认语言
    if (is_default) {
      await vk.baseDao.update({
        dbName: dbName.settingI18n,
        whereJson: {
          is_default: true,
          _id: _.neq(_id),
        },
        dataJson: {
          is_default: false,
        },
      });
    }

    res.num = await vk.baseDao.updateById({
      dbName: dbName.settingI18n,
      id: _id,
      dataJson: {
        name,
        locale,
        is_default,
        sort: sortNum,
      },
    });

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 删除语言，同时删除内容表中该语言的所有内容
   * @url admin/setting/sys.i18n.delete 前端调用的url参数地址
   */
  delete: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    const { _id } = data;

    if (vk.pubfn.isNull(_id)) return { code: -1, msg: '_id不能为空' };

    let info = await vk.baseDao.findByWhereJson({
      dbName: dbName.settingI18n,
      whereJson: { _id },
    });
    if (!info) return { code: -1, msg: '要删除的语言不存在' };
    if (info.is_default) return { code: -1, msg: '默认语言不允许删除' };

    // 先删除该语言下的所有内容，再删除语言
    res.contentNum = await vk.baseDao.del({
      dbName: dbName.content,
      whereJson: {
        locale: info.locale,
      },
    });

    res.num = await vk.baseDao.deleteById({
      dbName: dbName.settingI18n,
      id: _id,
    });

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 获取语言下拉列表
   * @url admin/setting/sys.i18n.select 前端调用的url参数地址
   */
  select: async function (data) {
    let res = { code: 0, msg: '' };
    let { uid } = this.getClientInfo(); // 获取客户端信息
    // 业务逻辑开始-----------------------------------------------------------
    const rows = await vk.baseDao.select({
      dbName: dbName.settingI18n,
      getCount: false,
      getMain: true,
      pageIndex: 1,
      pageSize: -1,
      whereJson: {},
      fieldJson: {},
      sortArr: [{ name: 'sort', type: 'asc' }],
    });

    let list = [];
    for (let i in rows) {
      let item = rows[i];
      list.push({
        value: item.locale,
        label: item.name,
        is_default: item.is_default,
      });
    }

    res.list = list;
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 模板函数
   * @url admin/setting/sys.i18n.test 前端调用的url参数地址
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
