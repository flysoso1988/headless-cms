// 以下代码一般不需要更改-----------------------------------------------------------
// 以下代码一般不需要更改-----------------------------------------------------------
// 以下代码一般不需要更改-----------------------------------------------------------
module.exports = {
  /**
   * 万能第三方账号 - 登录
   * 调用示例可直接参考云函数 user/pub/loginByDouyin 内的写法
   */
  login: async (data, util) => {
    let { config, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    // 业务逻辑开始-----------------------------------------------------------

    let { clientInfo, type, provider, appid, openid, unionid, customData, extraRes, addLog } = data;

    // 参数非空检测
    let nullKey = vk.pubfn.isNullOneByObject({ clientInfo, provider, openid });
    if (nullKey) return { code: -1, msg: '参数 ' + nullKey + ' 不能为空' };
    if (vk.pubfn.isNull(clientInfo.APPID)) {
      return { code: -1, msg: 'clientInfo内的APPID不能为空' };
    }
    if (vk.pubfn.isNull(clientInfo.PLATFORM)) {
      return { code: -1, msg: 'clientInfo内的PLATFORM不能为空' };
    }
    let platform = vk.pubfn.getPlatformForUniId(clientInfo);

    // 获得锁的实例
    const lockManage = vk.getReentrantLockManage({
      id: `sys-login:${provider}-${unionid || openid}`, // 锁的id
      timeout: 5, // 锁的超时时间，超时后强制归还锁，单位秒，0代表永不超时，默认5秒
    });

    // 尝试获取锁
    let lock = await lockManage.lock();
    if (!lock) {
      return { code: -1, msg: `请求失败，请稍后再试` };
    }
    // 注意必须 try 包裹，防止自己的代码出现异常，锁无法及时归还
    try {
      // 查找用户是否存在
      let userInfo = await getUser(
        {
          clientInfo,
          provider,
          appid,
          unionid,
          openid,
        },
        util
      );

      if (vk.pubfn.isNotNull(userInfo) && vk.pubfn.isNotNullAll(userInfo[`${provider}_unionid`], unionid) && userInfo[`${provider}_unionid`] !== unionid) {
        return { code: -1, msg: '第三方账号与已有绑定信息不一致，请使用其他方式登录后处理绑定关系' };
      }

      // 定义openid和unionid存在userInfo的哪个字段中
      let fieldInfo = {
        [`${provider}_openid`]: {
          [platform]: openid,
        },
      };
      if (appid) {
        fieldInfo[`${provider}_openid`][`${platform}_${appid}`] = openid;
      }
      if (unionid) {
        fieldInfo[`${provider}_unionid`] = unionid;
      }

      // 执行登录接口
      res = await vk.login({
        clientInfo, // 客户端信息
        type, // 操作类型，login: 仅登录，register: 仅注册 不传则自动判断
        customData, // 自定义数据
        userInfo, // 用户信息
        fieldInfo, // 登录相关字段存储信息
      });

      Object.assign(res, extraRes);
      res.provider = provider;

      if (res.code !== 0) {
        // 登录失败
        return res;
      }

      // 登录成功

      if (addLog) {
        // 添加登录日志
        const loginLog = vk.require('service/user/util/loginLog');
        await loginLog.add(
          {
            type: 'login',
            login_type: provider,
            user_id: res.uid,
            context: clientInfo,
          },
          util
        );
      }
    } finally {
      // 归还锁
      await lock.unlock();
    }

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 万能第三方账号 - 绑定
   * 调用示例可直接参考云函数 user/kh/bindDouyin 内的写法
   */
  bind: async (data, util) => {
    let { config, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    // 业务逻辑开始-----------------------------------------------------------

    let { clientInfo, userInfo, provider, providerName = '', appid, openid, unionid, extraRes, customData, encryptedKey } = data;

    if (!openid && encryptedKey) {
      // 解密获得openid和unionid
      let decryptedRes = vk.crypto.aes.decrypt({
        data: encryptedKey, // 待解密的原文
      });
      appid = decryptedRes.appid;
      openid = decryptedRes.openid;
      unionid = decryptedRes.unionid;
    }

    // 参数非空检测
    let nullKey = vk.pubfn.isNullOneByObject({ clientInfo, userInfo, provider, openid });
    if (nullKey) return { code: -1, msg: '参数 ' + nullKey + ' 不能为空' };

    if (vk.pubfn.isNotNullAll(userInfo[`${provider}_unionid`], unionid) && userInfo[`${provider}_unionid`] !== unionid) {
      return { code: 1, msg: `当前账号已绑定其他${providerName || '第三方'}账号，请先解绑后再绑定` };
    }

    let platform = vk.pubfn.getPlatformForUniId(clientInfo);

    // 判断当前登录用户是否已经绑定过
    if (appid) {
      if (userInfo[`${provider}_openid`] && userInfo[`${provider}_openid`][`${platform}_${appid}`]) {
        return { code: 1, msg: `当前账号已绑定${providerName}，请勿重复绑定` };
      }
    } else {
      if (userInfo[`${provider}_openid`]) {
        return { code: 1, msg: `当前账号已绑定${providerName}，请勿重复绑定` };
      }
    }
    // 查找用户是否存在
    let currentAppUser = await getUser(
      {
        clientInfo,
        provider,
        appid,
        unionid,
        openid,
      },
      util
    );

    if (currentAppUser && currentAppUser._id !== userInfo._id) {
      return { code: 1, msg: `当前${providerName}号已绑定其他账号，请先解绑` };
    }

    // 需要修改的字段信息
    let updateDataJson = {
      [`${provider}_openid`]: {
        [platform]: openid,
      },
    };
    if (appid) {
      updateDataJson[`${provider}_openid`][`${platform}_${appid}`] = openid;
    }
    if (!userInfo[`${provider}_unionid`] && unionid) {
      updateDataJson[`${provider}_unionid`] = unionid;
    }

    if (typeof customData === 'object') {
      updateDataJson = Object.assign(updateDataJson, customData);
    }

    let num = await vk.daoCenter.userDao.updateById({
      id: userInfo._id,
      dataJson: updateDataJson,
    });

    res.msg = num > 0 ? '绑定成功' : '绑定失败';

    Object.assign(res, extraRes);

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
  /**
   * 万能第三方账号 - 解绑
   * 调用示例可直接参考云函数 user/kh/unbindDouyin 内的写法
   */
  unbind: async (data, util) => {
    let { config, vk, db, _ } = util;
    let res = { code: 0, msg: '' };
    // 业务逻辑开始-----------------------------------------------------------

    let {
      userInfo,
      provider,
      providerName,
      appid, // 注意：如果不传appid，则解绑所有
    } = data;

    // 参数非空检测
    let nullKey = vk.pubfn.isNullOneByObject({ userInfo, provider });
    if (nullKey) return { code: -1, msg: '参数 ' + nullKey + ' 不能为空' };

    // 如果账户没有绑定手机号或没有设置用户名则不允许解绑（因为解绑后会造成无法登录）
    if (vk.pubfn.isNullAll(userInfo.mobile, userInfo.username)) {
      return { code: -1, msg: `为了您的账号安全，请绑定手机号后再解绑${providerName}` };
    }

    // 判断当前登录用户是否已经绑定过
    if (!userInfo[`${provider}_openid`]) {
      return { code: 1, msg: `当前账号未绑定${providerName}，无需解绑` };
    }

    // 定义openid和unionid存在userInfo的哪个字段中
    let openidData = userInfo[`${provider}_openid`];
    let fieldInfo = {};
    if (!appid) {
      // 如果不传appid，则解绑所有
      fieldInfo = {
        [`${provider}_openid`]: _.remove(),
        [`${provider}_unionid`]: _.remove(),
      };
    } else {
      // 找到对应appid的key
      let openidKeys = Object.keys(openidData);
      let key = openidKeys.find((item) => {
        return item.indexOf(`_${appid}`) > -1;
      });
      if (vk.pubfn.isNull(key)) {
        return { code: 1, msg: `当前账号未绑定${providerName}，无需解绑` };
      }
      // 从key中获取platform
      let platform = key.substring(0, key.length - appid.length - 1);
      // 当前平台是否还有其他appid的key
      let hasOtherPlatformAppidKey = openidKeys.some((item) => {
        return item !== key && item.indexOf(`${platform}_`) === 0;
      });
      let needUnbindPlatform = vk.pubfn.isNotNull(openidData[platform]) && (!hasOtherPlatformAppidKey || openidData[platform] === openidData[key]);
      let removeKeyList = [key];
      // 平台字段指向本次解绑的openid，或当前平台已无其他appid时，一并清除
      if (needUnbindPlatform) {
        removeKeyList.push(platform);
      }
      // 计算解绑后还剩下的openid的key
      let remainOpenidKeys = openidKeys.filter((item) => {
        return removeKeyList.indexOf(item) === -1;
      });
      // 如果解绑后没有openid了，则unionid也解绑；如果解绑后还有其他openid，则unionid不解绑
      if (remainOpenidKeys.length === 0) {
        fieldInfo = {
          [`${provider}_openid`]: _.remove(),
          [`${provider}_unionid`]: _.remove(),
        };
      } else {
        fieldInfo = {
          [`${provider}_openid.${key}`]: _.remove(),
        };
        if (needUnbindPlatform) {
          fieldInfo[`${provider}_openid.${platform}`] = _.remove();
        }
      }
    }

    let num = await vk.daoCenter.userDao.updateById({
      id: userInfo._id,
      dataJson: fieldInfo,
    });

    res.msg = num > 0 ? '解绑成功' : '解绑失败';

    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
};

async function getUser(obj = {}, util) {
  let { vk, _ } = util;
  let { clientInfo, provider, appid, unionid, openid } = obj;
  let platform = vk.pubfn.getPlatformForUniId(clientInfo);
  let orArr = [];
  if (unionid) {
    orArr.push({
      [`${provider}_unionid`]: unionid,
    });
  }
  if (openid) {
    let openidWhereJson = {
      [`${provider}_openid.${platform}`]: openid,
    };
    if (appid) {
      let appidOpenidKey = `${provider}_openid.${platform}_${appid}`;
      orArr.push({ [appidOpenidKey]: openid });
      // 兼容缺少当前应用专属字段的旧数据，已有专属字段时不回退
      openidWhereJson[appidOpenidKey] = _.exists(false);
    }
    orArr.push(openidWhereJson);
  }
  let userInfo = await getCurrentAppUser(
    {
      whereJson: _.or(orArr),
      clientInfo,
    },
    util
  );
  return userInfo;
}

async function getCurrentAppUser(obj = {}, util) {
  let { vk } = util;
  let { whereJson, clientInfo } = obj;
  let userList = await vk.daoCenter.userDao.select({
    pageIndex: 1,
    pageSize: 1000,
    getMain: true,
    whereJson,
  });
  const dcloudAppid = clientInfo.APPID || clientInfo.appId;
  userList = userList.filter((item) => {
    return item.dcloud_appid === undefined || item.dcloud_appid === null || item.dcloud_appid.indexOf(dcloudAppid) > -1 || item.dcloud_appid.indexOf(null) > -1;
  });
  return userList && userList[0];
}
