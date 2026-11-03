const formRules = require('../util/formRules.js');
module.exports = {
  /**
   * 批量新增
   * @url admin/system/menu/sys/adds 前端调用的url参数地址
   * data 请求参数 说明
   * @param {Number} mode 					模式 1 :覆盖 2:忽略
   * @param {Array<Object>} menus 	菜单json
   * res 返回参数说明
   * @param {Number} code 错误码，0表示成功
   * @param {String} msg 详细信息
   */
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let { uid } = data;
    let res = { code: 0, msg: '' };
    // 业务逻辑开始-----------------------------------------------------------
    let { mode, menus } = data;

    // 参数合法校验开始-----------------------------------------------------------
    let formRulesRes = await formRules.adds(event);
    if (formRulesRes.code !== 0) {
      return formRulesRes;
    }
    // 参数合法校验结束-----------------------------------------------------------
    let dataArr = [];
    for (let i = 0; i < menus.length; i++) {
      let { menu_id, name, comment, url, icon, sort = 0, parent_id, enable = true, hidden_menu } = menus[i];

      dataArr.push({
        menu_id,
        name,
        comment,
        url,
        icon,
        sort,
        parent_id,
        enable,
        hidden_menu,
      });
    }
    if ((mode == 1 || mode == 2) && dataArr.length > 0) {
      let menuIds = vk.pubfn.arrayObjectGetArray(dataArr, 'menu_id');
      // 批量读取已有菜单，复用于覆盖时保留权限和忽略时过滤重复标识。
      let oldMenus = await vk.baseDao.select({
        dbName: 'opendb-admin-menus',
        pageSize: menuIds.length,
        getMain: true,
        whereJson: {
          menu_id: _.in(menuIds),
        },
      });
      if (mode == 1) {
        const permissionMap = new Map(oldMenus.map((item) => [item.menu_id, item.permission]));
        dataArr.forEach((item) => {
          item.permission = permissionMap.get(item.menu_id);
        });
        // 如果是覆盖，则先删除原先的数据
        await vk.baseDao.del({
          dbName: 'opendb-admin-menus',
          whereJson: {
            menu_id: _.in(menuIds),
          },
        });
      } else {
        // 忽略已有标识及本批重复标识，只保留首次出现的新菜单。
        const menuIdSet = new Set(oldMenus.map((item) => item.menu_id));
        dataArr = dataArr.filter((item) => {
          if (menuIdSet.has(item.menu_id)) return false;
          menuIdSet.add(item.menu_id);
          return true;
        });
      }
    }
    // 执行数据库API请求
    if (dataArr.length > 0) {
      await vk.baseDao.adds({
        dbName: 'opendb-admin-menus',
        dataJson: dataArr,
      });
    }
    return res;
  },
};
