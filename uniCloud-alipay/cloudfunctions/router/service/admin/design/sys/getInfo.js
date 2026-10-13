module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    let dbName = 'vk-design-page';
    let _id = data._id;
    // 获取详情操作
    res = await vk.baseDao.getById({
      dbName,
      whereJson: { _id },
    });
    return res;
  },
};
