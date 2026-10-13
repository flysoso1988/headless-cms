module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    let dbName = 'vk-cms-model-field';
    let { _id } = data;

    if (vk.pubfn.isNullOne(_id)) {
      return { code: -1, msg: '_id不能为空' };
    }

    await vk.baseDao.deleteById({
      dbName,
      id: _id,
    });

    return res;
  },
};
