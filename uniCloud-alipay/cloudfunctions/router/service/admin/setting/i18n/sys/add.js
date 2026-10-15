module.exports = {
  main: async (event) => {
    let { data = {}, util } = event;
    let { vk } = util;
    let res = { code: 0, msg: '' };

    let { name, locale, is_default = false } = data;

    if (vk.pubfn.isNull(name)) return { code: -1, msg: '显示名称不能为空' };
    if (vk.pubfn.isNull(locale)) return { code: -1, msg: '语言不能为空' };

    let existItem = await vk.baseDao.findByWhereJson({
      dbName: 'vk-cms-i18n',
      whereJson: { locale },
    });
    if (existItem) return { code: -1, msg: '语言【' + locale + '】已存在' };

    // 只允许存在一个默认语言
    if (is_default) {
      await vk.baseDao.update({
        dbName: 'vk-cms-i18n',
        whereJson: { is_default: true },
        dataJson: { is_default: false },
      });
    }

    res.id = await vk.baseDao.add({
      dbName: 'vk-cms-i18n',
      dataJson: { name, locale, is_default },
    });

    return res;
  },
};
