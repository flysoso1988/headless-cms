module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };

    let { name, key, type, status = true, draft = false, internationalization = false, display_fields = [] } = data;

    res.id = await vk.baseDao.add({
      dbName: 'vk-cms-model',
      dataJson: {
        name,
        key,
        type,
        status,
        draft,
        internationalization,
        display_fields,
      },
    });

    return res;
  },
};
