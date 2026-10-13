module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    let dbName = 'vk-cms-model-field';
    res = await vk.baseDao.findById({
      dbName,
      id: data._id,
    });
    return res;
  },
};
