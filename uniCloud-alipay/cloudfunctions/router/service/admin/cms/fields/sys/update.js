module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    let { _id, key, type, model_id, data: options, fileType, multiple, multipleLimit, default_value, condition, required, sort, relation } = data;

    if (vk.pubfn.isNullOne(_id)) {
      return { code: -1, msg: '_id不能为空' };
    }

    await vk.baseDao.updateById({
      dbName: 'vk-cms-model-field',
      id: _id,
      dataJson: {
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
