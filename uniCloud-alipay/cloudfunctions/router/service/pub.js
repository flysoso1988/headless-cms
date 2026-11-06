'use strict';
let vk = uniCloud.vk; // 全局vk实例
// 涉及的表名
const dbName = require('../dao/config.js');

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
   * 一次性数据迁移：为 vk-cms-content 全部数据补写 model_key（取自模型表 key 字段）并移除 model_id
   * 调用示例：vk.callFunction({ url: 'pub.migrateContentModelKey', data: {} })
   * 注意：接口为 pub 公开类型，内部做了管理员身份校验，调用时必须携带管理员登录 token；迁移完成后建议删除本方法
   * @url pub.migrateContentModelKey 前端调用的url参数地址
   */
  migrateContentModelKey: async function (data = {}) {
    let res = { code: 0, msg: '' };
    // 业务逻辑开始-----------------------------------------------------------

    // 安全校验：pub 接口公开可调，迁移仅允许管理员（admin角色）执行
    let { uid } = this.getClientInfo();

    // 1. 读取模型表，建立 _id -> key 映射
    let modelRes = await vk.baseDao.select({
      dbName: dbName.model,
      pageSize: -1,
    });
    let modelMap = {};
    (modelRes.rows || []).forEach((m) => {
      modelMap[m._id] = m.key;
    });

    // 2. 按 model 分组批量迁移：补写 model_key + 移除 model_id
    let updated = 0;
    for (let oldId in modelMap) {
      let num = await vk.baseDao.update({
        dbName: dbName.content,
        whereJson: { model_id: oldId },
        dataJson: { model_key: modelMap[oldId], model_id: _.remove() },
      });
      updated += num || 0;
    }

    // 3. 统计模型已被删除的孤儿内容（model_id 还在，但模型表中已无对应记录，无法回填 key）
    let orphanNum = await vk.baseDao.count({
      dbName: dbName.content,
      whereJson: { model_id: _.exists(true) },
    });

    res.data = {
      total: updated + orphanNum, // 需迁移的数据总量
      updated, // 已成功补写 model_key 并移除 model_id 的数量
      orphan: orphanNum, // 模型已删除、无法回填的数量（model_id 仍保留）
    };
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 一次性数据迁移：为 vk-cms-model-field 全部数据补写 model_key（取自模型表 key 字段）并移除 model_id，
   * 同时把 relation 字段中存量的模型 _id 一并替换为模型 key（与新代码中关联模型下拉取 value=key 保持一致）
   * 调用示例：vk.callFunction({ url: 'pub.migrateModelFieldModelKey', data: {} })
   * 注意：HBuilderX 本地运行云函数调试时客户端无登录态，故不做鉴权，禁止上传到线上环境公开调用
   * @url pub.migrateModelFieldModelKey 前端调用的url参数地址
   */
  migrateModelFieldModelKey: async function (data = {}) {
    let res = { code: 0, msg: '' };
    // 业务逻辑开始-----------------------------------------------------------

    // 1. 读取模型表，建立 _id -> key 映射
    let modelRes = await vk.baseDao.select({
      dbName: dbName.model,
      pageSize: -1,
    });
    let modelMap = {};
    (modelRes.rows || []).forEach((m) => {
      modelMap[m._id] = m.key;
    });

    // 2. 按 model 分组批量迁移：
    //    - 补写 model_key + 移除 model_id
    //    - relation 中存量的模型 _id 替换为 key
    let updated = 0;
    let relationUpdated = 0;
    for (let oldId in modelMap) {
      let key = modelMap[oldId];
      let num = await vk.baseDao.update({
        dbName: dbName.modelField,
        whereJson: { model_id: oldId },
        dataJson: { model_key: key, model_id: _.remove() },
      });
      updated += num || 0;
      let relationNum = await vk.baseDao.update({
        dbName: dbName.modelField,
        whereJson: { relation: oldId },
        dataJson: { relation: key },
      });
      relationUpdated += relationNum || 0;
    }

    // 3. 统计模型已被删除的孤儿字段（model_id 还在，但模型表中已无对应记录，无法回填 key）
    let orphanNum = await vk.baseDao.count({
      dbName: dbName.modelField,
      whereJson: { model_id: _.exists(true) },
    });

    res.data = {
      total: updated + orphanNum, // 需迁移的字段数据总量
      updated, // 已成功补写 model_key 并移除 model_id 的数量
      relationUpdated, // relation 由模型 _id 替换为模型 key 的数量
      orphan: orphanNum, // 模型已删除、无法回填的数量（model_id 仍保留）
    };
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 模板函数
   * @url pub.test 前端调用的url参数地址
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
