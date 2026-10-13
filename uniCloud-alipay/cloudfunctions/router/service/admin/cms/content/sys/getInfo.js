module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    let { _id } = data;
    if (vk.pubfn.isNull(_id)) {
      return { code: -1, msg: '缺少_id参数' };
    }
    let dbName = 'vk-cms-content';
    res.info = await vk.baseDao.findById({ dbName, id: _id });
    if (res.info && res.info.model_id) {
      let modelRes = await vk.baseDao.findById({ dbName: 'vk-cms-model', id: res.info.model_id });
      res.modelInfo = modelRes;
    }
    return res;
  },
};
