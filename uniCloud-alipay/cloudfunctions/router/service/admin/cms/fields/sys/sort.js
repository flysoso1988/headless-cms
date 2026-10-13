module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    let dbName = 'vk-cms-model-field';
    let { ids } = data;

    if (vk.pubfn.isNull(ids)) return { code: -1, msg: 'ids不能为空' };

    for (let i = 0; i < ids.length; i++) {
      await vk.baseDao.updateById({
        dbName,
        id: ids[i],
        dataJson: { sort: i },
      });
    }

    return res;
  },
};
