const contentWrite = require('../util/contentWrite.js');
module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    let { model_id, status, document_id, locale } = data;
    if (vk.pubfn.isNullOne(model_id)) {
      return { code: -1, msg: 'model_id不能为空' };
    }
    // 查询模型字段定义
    let fieldRes = await vk.baseDao.select({ dbName: 'vk-cms-model-field', whereJson: { model_id } });
    // document_id 为空时自动生成，用于后续国际化版本关联
    if (vk.pubfn.isNullOne(document_id)) {
      document_id = 'doc_' + new Date().getTime() + '_' + vk.pubfn.random(6, 'abcdefghijklmnopqrstuvwxyz0123456789');
    }
    // 只提取基础字段和模型定义的动态字段
    let dataJson = { model_id, status, document_id };
    if (!vk.pubfn.isNullOne(locale)) dataJson.locale = locale;
    // 按字段定义生成写入白名单，并对动态区块做递归一层校验
    let buildRes = await contentWrite.buildContentFieldData({ vk, data, modelFields: fieldRes.rows || [] });
    if (buildRes.code !== 0) return buildRes;
    Object.assign(dataJson, buildRes.dataJson);
    let dbName = 'vk-cms-content';
    res.id = await vk.baseDao.add({ dbName, dataJson });
    res.msg = '添加成功';
    return res;
  },
};
