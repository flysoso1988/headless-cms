module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    const { title, key, type, model_id, data: options, fileType, multiple, multipleLimit, default_value, condition, required, sort, relation } = data;

    if (key === 'status') {
      return { code: -1, msg: '字段标识 status 已被系统预留，不能使用' };
    }

    res.id = await vk.baseDao.add({
      dbName: 'vk-cms-model-field',
      dataJson: {
        title,
        key,
        type,
        model_id,
        data: options,
        fileType,
        multiple,
        multipleLimit,
        default_value,
        condition,
        required,
        sort,
        relation,
      },
    });

    return res;
  },
};
