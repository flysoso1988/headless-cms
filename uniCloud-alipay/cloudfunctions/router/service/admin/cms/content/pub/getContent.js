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
      // 除远程下拉需要的 value/label 外，原样透出内容文档字段（含动态区块数组），
      // 消费端据 __component 逐块渲染，后台不做任何加工与清洗
      list.push(
        Object.assign({}, item, {
          value: value,
          label: label,
        })
      );
    }
    res.list = list;
    return res;
  },
};
