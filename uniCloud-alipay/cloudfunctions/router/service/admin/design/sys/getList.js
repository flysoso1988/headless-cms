module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    let dbName = 'vk-design-page';
    let formData = data.formData || {};
    let whereJson = {};
    res = await vk.baseDao.getTableData({
      dbName,
      data,
      whereJson,
      sortArr: [
        { name: 'sort', type: 'desc' },
        { name: '_add_time', type: 'desc' },
      ],
    });
    return res;
  },
};
