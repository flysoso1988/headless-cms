module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    let { _id } = data;
    if (vk.pubfn.isNullOne(_id)) {
      return { code: -1, msg: '_id不能为空' };
    }
    let dbName = 'vk-cms-content';
    let whereJson = {};
    if (Array.isArray(_id)) {
      whereJson._id = _.in(_id);
    } else {
      whereJson._id = _id;
    }
    res.num = await vk.baseDao.del({ dbName, whereJson });
    res.msg = `成功删除 ${res.num} 条数据`;
    return res;
  },
};
