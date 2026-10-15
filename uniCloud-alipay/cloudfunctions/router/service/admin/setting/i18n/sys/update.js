module.exports = {
  main: async (event) => {
    let { data = {}, util } = event;
    let { vk, _ } = util;
    let res = { code: 0, msg: '' };

    let { _id, name, locale, is_default = false } = data;

    if (vk.pubfn.isNull(_id)) return { code: -1, msg: '_id不能为空' };
    if (vk.pubfn.isNull(name)) return { code: -1, msg: '显示名称不能为空' };
    if (vk.pubfn.isNull(locale)) return { code: -1, msg: '语言不能为空' };

    let existItem = await vk.baseDao.findByWhereJson({
      dbName: 'vk-cms-i18n',
      whereJson: { locale, _id: _.neq(_id) },
    });
    if (existItem) return { code: -1, msg: '语言【' + locale + '】已存在' };

    // 只允许存在一个默认语言
    if (is_default) {
      await vk.baseDao.update({
        dbName: 'vk-cms-i18n',
        whereJson: { is_default: true, _id: _.neq(_id) },
        dataJson: { is_default: false },
      });
    }

    res.num = await vk.baseDao.updateById({
      dbName: 'vk-cms-i18n',
      id: _id,
      dataJson: { name, locale, is_default },
    });

    return res;
  },
};
