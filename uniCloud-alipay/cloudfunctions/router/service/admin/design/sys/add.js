module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    let dbName = 'vk-design-page';
    let formData = data.formData || {};
    // 添加操作
    res = await vk.baseDao.add({
      dbName,
      dataJson: formData,
    });
    return res;
  },
};
