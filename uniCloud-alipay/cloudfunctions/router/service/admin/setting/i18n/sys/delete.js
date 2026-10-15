module.exports = {
  main: async (event) => {
    let { data = {}, util } = event;
    let { vk } = util;
    let res = { code: 0, msg: '' };

    let { _id } = data;

    if (vk.pubfn.isNull(_id)) return { code: -1, msg: '_id不能为空' };

    let info = await vk.baseDao.findByWhereJson({
      dbName: 'vk-cms-i18n',
      whereJson: { _id },
    });
    if (!info) return { code: -1, msg: '要删除的语言不存在' };
    if (info.is_default) return { code: -1, msg: '默认语言不允许删除' };

    res.num = await vk.baseDao.del({
      dbName: 'vk-cms-i18n',
      whereJson: { _id },
    });

    return res;
  },
};
