module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _, $ } = util;
    let res = { code: 0, msg: '' };
    let whereJson = {};
    if (data.type) whereJson.type = data.type;

    res = await vk.baseDao.selects({
      dbName: 'vk-cms-model',
      pageIndex: 1,
      pageSize: 500,
      whereJson,
      sortArr: [{ name: 'key', type: 'asc' }],
      foreignDB: [
        {
          dbName: 'vk-cms-model-field',
          localKey: '_id',
          foreignKey: 'model_id',
          as: 'fields',
          sortArr: [{ name: 'sort', type: 'asc' }],
          limit: 500,
        },
      ],
    });
    return res;
  },
};
