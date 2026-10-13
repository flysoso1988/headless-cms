module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    let dbName = 'vk-design-page';
    let formData = data.formData || {};
    let _id = data._id || formData._id;
    // 更新操作
    res = await vk.baseDao.update({
      dbName,
      whereJson: { _id },
      dataJson: formData,
    });
    return res;
  },
};
