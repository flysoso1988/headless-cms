module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    let dbName = 'vk-cms-content';
    let formData = data.formData || {};
    let model_id = data.model_id || formData.model_id;
    let whereJson = {};
    if (model_id) whereJson.model_id = model_id;
    res = await vk.baseDao.getTableData({
      dbName,
      data,
      whereJson,
      sortArr: [{ name: '_add_time', type: 'desc' }],
      foreignDB: [
        {
          dbName: 'uni-id-users',
          localKey: 'user_id',
          foreignKey: '_id',
          as: 'user',
          limit: 1,
        },
      ],
    });
    return res;
  },
};
