module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    let dbName = 'vk-cms-model-field';
    let { model_id, pageSize = 500, sortArr = [{ name: 'sort', order: 'asc' }] } = data;
    let whereJson = {};
    if (model_id) {
      whereJson.model_id = model_id;
    }
    res = await vk.baseDao.getTableData({
      dbName,
      data,
      whereJson,
      sortArr,
    });
    return res;
  },
};
