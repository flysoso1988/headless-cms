module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };

    const { model_id } = data;

    let selectRes = await vk.baseDao.selects({
      dbName: 'vk-cms-content',
      whereJson: {
        model_id,
      },
    });

    let list = [];
    for (let i in selectRes.rows) {
      let item = selectRes.rows[i];
      let value = item._id;
      let label = item.title;
      list.push({
        value: value,
        label: label,
      });
    }
    res.list = list;
    return res;
  },
};
