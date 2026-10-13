module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    let { _id, model_id, status, document_id, locale } = data;
    if (vk.pubfn.isNullOne(_id)) {
      return { code: -1, msg: '_id不能为空' };
    }
    // 查询模型字段定义
    let fieldRes = await vk.baseDao.select({ dbName: 'vk-cms-model-field', whereJson: { model_id } });
    let allowedKeys = (fieldRes.rows || []).map((f) => f.key);
    // 只提取基础字段和模型定义的动态字段
    let dataJson = { model_id, status, document_id };
    if (!vk.pubfn.isNullOne(locale)) dataJson.locale = locale;
    allowedKeys.forEach((key) => {
      if (data[key] !== undefined) {
        dataJson[key] = data[key];
      }
    });
    let dbName = 'vk-cms-content';
    res.num = await vk.baseDao.update({
      dbName,
      whereJson: { _id },
      dataJson,
    });
    res.msg = '修改成功';
    return res;
  },
};
