const dbName = require('../../../../../dao/config.js');

module.exports = {
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let res = { code: 0, msg: '' };

    const { model_id } = data;

    // 该模型的动态区块字段（仅这些字段需要额外透出块数组，其余字段维持 value/label 契约不变）
    let fieldRes = await vk.baseDao.select({
      dbName: dbName.modelField,
      whereJson: {
        model_id,
        type: 'dynamiczone',
      },
    });
    let dynamicZoneKeys = (fieldRes.rows || []).map((f) => f.key);

    let selectRes = await vk.baseDao.selects({
      dbName: dbName.content,
      whereJson: {
        model_id,
      },
    });

    let list = [];
    for (let i in selectRes.rows) {
      let item = selectRes.rows[i];
      let value = item._id;
      let label = item.title;
      let option = { value: value, label: label };
      // 动态区块字段原样透出块数组，消费端据 __component 逐块渲染，后台不做任何加工与清洗
      dynamicZoneKeys.forEach((key) => {
        if (item[key] !== undefined) option[key] = item[key];
      });
      list.push(option);
    }
    res.list = list;
    return res;
  },
};
