module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    let { _id, name, key, type, status = true, draft = true, internationalization = false, display_fields } = data;

    if (vk.pubfn.isNullOne(_id)) {
      return { code: -1, msg: '_id不能为空' };
    }

    let dataJson = { name, key, type, status, draft, internationalization };
    if (display_fields !== undefined) {
      dataJson.display_fields = display_fields;
    }

    await vk.baseDao.updateById({
      dbName: 'vk-cms-model',
      id: _id,
      dataJson,
    });

    return res;
  },
};
