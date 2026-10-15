module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    let { _id, model_key } = data;
    let dbName = 'vk-cms-model';
    let whereJson = {};
    if (_id) {
      whereJson._id = _id;
    } else if (model_key) {
      whereJson.key = model_key;
    } else {
      return { code: -1, msg: '缺少_id或model_key参数' };
    }
    res.info = await vk.baseDao.findByWhereJson({ dbName, whereJson });
    // 附带模型字段定义，前端据此渲染内容表单
    if (res.info) {
      let fieldRes = await vk.baseDao.select({
        dbName: 'vk-cms-model-field',
        whereJson: { model_id: res.info._id },
        sortArr: [{ name: 'sort', type: 'asc' }],
        pageSize: 500,
      });
      res.info.fields = fieldRes.rows || [];
    }
    return res;
  },
};
