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
    return res;
  },
};
