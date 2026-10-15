module.exports = {
  main: async (event) => {
    let { data = {}, util } = event;
    let { vk } = util;
    let res = { code: 0, msg: '' };

    res = await vk.baseDao.getTableData({
      dbName: 'vk-cms-i18n',
      data,
      // 默认语言排在最前，其余按创建时间升序
      sortArr: [
        { name: 'is_default', type: 'desc' },
        { name: '_add_time', type: 'asc' },
      ],
    });

    return res;
  },
};
