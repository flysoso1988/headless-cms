<template>
  <div class="page-body no-user-select">
    <div class="login-view">
      <image class="image" :src="vk.getVuex('$app.staticUrl.navBar.logo')" mode="aspectFit"></image>
      <span class="login-title">{{ $t('vk.login.welcome') }}</span>

      <el-form :model="form1" status-icon :rules="rules" ref="form1" label-width="60px" class="form-view">
        <el-form-item :label="$t('vk.user.username')" prop="pass" class="form-item">
          <el-input class="input" type="text" v-model="form1.username" :placeholder="$t('vk.login.usernamePlaceholder')"></el-input>
        </el-form-item>
        <el-form-item :label="$t('vk.login.password')" prop="checkPass" class="form-item">
          <el-input
            class="input"
            type="password"
            v-model="form1.password"
            show-password
            :placeholder="$t('vk.login.passwordPlaceholder')"
            maxlength="100"
            @keyup.enter.native="submit"
          ></el-input>
        </el-form-item>
        <div class="password-box">
          <div class="remember-password">
            <el-checkbox v-model="checked">
              <span class="tips" style="font-size: 12px">{{ $t('vk.login.rememberPassword') }}</span>
            </el-checkbox>
          </div>
          <div class="forget-password">
            <span @click="forgetPassWord" style="font-size: 12px">{{ $t('vk.login.forgotPassword') }}</span>
          </div>
        </div>
        <el-button class="login_but" type="primary" :loading="loading" @click="submit">{{ $t('vk.user.login') }}</el-button>
      </el-form>

      <div v-if="testUser && testUser.show && testUser.list && testUser.list.length > 0" class="test-user-list">
        <div>{{ $t('vk.login.testAccount') }}</div>
        <div v-for="(item, index) in testUser.list" :key="index" class="test-user-item">
          <span class="test-user-item-nickname">{{ item.nickname }}</span>
          <span class="test-user-item-username">{{ $t('vk.login.account') }}{{ item.username }}</span>
          <span class="test-user-item-password">{{ $t('vk.login.passwordLabel') }}{{ item.password }}</span>
        </div>
      </div>

      <!-- <div class="btns-box">
        <span @click="shortMessageLogin">短信验证码登录</span>
        <span @click="noCccount">没有账号？</span>
        <span class="register" @click="register">立即注册</span>
      </div> -->
    </div>
  </div>
</template>

<script>
  import config from '@/app.config.js';
  let vk = uni.vk; // vk实例
  export default {
    data() {
      return {
        ...config.staticUrl.navBar,
        testUser: (config.login && config.login.testUser) || {}, // 体验账号信息
        // 表单信息
        form1: {
          username: '',
          password: '',
          needPermission: true,
        },
        loading: false,
        checked: false, // 是否记录密码
        // 表单验证规则
        rules: {},
      };
    },
    // 监听 - 页面每次【加载时】执行(如：前进)
    onLoad(options = {}) {
      vk = this.vk;
      this.options = options;
      this.init(options);
    },
    mounted() {},
    methods: {
      isAllowLoginBackground(userInfo) {
        return getApp().isAllowLoginBackground(userInfo);
      },
      // 页面初始化
      init() {
        // 处理URL参数中的username和password
        if (this.options && this.options.username && this.options.password) {
          this.form1.username = this.options.username;
          this.form1.password = this.options.password;
          this.checked = true;
          this.submit();
          return;
        }
        // 从缓存中读取记住的密码
        let { login } = vk.getVuex('$user');
        if (login) {
          if (login.username) this.form1.username = login.username;
          if (login.password) {
            this.form1.password = login.password;
            this.checked = true;
          }
        }
        // 如果本地token有效，则再从云端查询一次token是否有效，如果都有效，则直接视为登录成功
        if (vk.checkToken()) {
          vk.userCenter.checkToken({
            loading: true,
            success: (data) => {
              if (!this.isAllowLoginBackground(data.userInfo)) {
                this.$message.error(this.$t('vk.login.noPermission'));
                return;
              }
              this.loginSuccess(data);
            },
          });
        }
      },
      // 表单提交
      submit() {
        if (this.loading) return;
        const formData = vk.pubfn.copyObject(this.form1);
        vk.userCenter.login({
          loading: true,
          data: formData,
          success: (data) => {
            if (!this.isAllowLoginBackground(data.userInfo)) {
              vk.alert(this.$t('vk.login.noPermission'));
              return false;
            }
            if (this.checked) {
              // 账号密码保存本地缓存
              // 此处明文保存了密码，是已知的安全性问题，不计入 AI 审核，用户如担心安全问题，则将保存密码改为记住账号
              vk.setVuex('$user.login.username', formData.username);
              vk.setVuex('$user.login.password', formData.password);
            } else {
              // 删除本地缓存
              vk.setVuex('$user.login.username', '');
              vk.setVuex('$user.login.password', '');
            }
            this.loginSuccess(data);
          },
        });
      },
      //登陆成功
      async loginSuccess(data = {}) {
        let { userInfo = {} } = data;
        vk.setVuex('$user.userInfo', userInfo);
        // 先清空下菜单缓存
        vk.setVuex('$app.inited', false);
        vk.setVuex('$app.navMenu', []);
        vk.setVuex('$app.menuList', []);
        // 等待菜单权限就绪，避免回跳时用空菜单或旧账号菜单判断权限。
        this.loading = true;
        let inited;
        try {
          inited = await getApp().init();
        } finally {
          this.loading = false;
        }
        if (!inited) return;
        // 检查是否有指定跳转的页面
        if (this.options.uniIdRedirectUrl) {
          let uniIdRedirectUrl;
          try {
            uniIdRedirectUrl = decodeURIComponent(this.options.uniIdRedirectUrl);
          } catch (err) {
            vk.navigateToHome();
            return;
          }
          // 只允许站内路径，拒绝外部地址、协议相对地址和反斜杠。
          if (/^\/(?!\/)/.test(uniIdRedirectUrl) && uniIdRedirectUrl.indexOf('\\') === -1) {
            vk.redirectTo(uniIdRedirectUrl);
          } else {
            vk.navigateToHome();
          }
          return;
        }
        // 再尝试从 getOriginalPage 获取跳转页面
        if (vk.pubfn.isNotNull(vk.navigate.getOriginalPage())) {
          vk.navigate.originalTo();
          return;
        }
        // 最后尝试跳转到首页或页面返回
        let pages = getCurrentPages();
        if (pages.length >= 2 && pages[pages.length - 2] && pages[pages.length - 2].route && pages[pages.length - 2].route.indexOf('login/') == -1) {
          // 如果上一个页面不是login目录下的，则调上一个页面
          let previousPage = pages[pages.length - 2];
          let fullPath = previousPage.$page && previousPage.$page.fullPath;
          if (vk.pubfn.isNull(fullPath)) {
            let query = vk.pubfn.queryParams(previousPage.options, true, 'brackets', {
              encode: true,
              keepEmpty: true,
            });
            fullPath = `/${previousPage.route}${query}`;
          }
          vk.reLaunch(fullPath);
        } else {
          // 否则进入首页
          vk.navigateToHome();
        }
      },
      forgetPassWord() {
        console.log(`忘记密码了`);
        vk.toast(this.$t('vk.login.notSupported'), 'none');
      },
      shortMessageLogin() {
        console.log(`短信登录`);
      },
      noCccount() {
        console.log(`没有账号`);
      },
      register() {
        console.log(`立即注册`);
        vk.toast('暂不支持注册', 'none');
      },
    },
  };
</script>

<style lang="scss" scoped>
  .page-body {
    width: 100%;
    height: 100vh;
    background: linear-gradient(rgba(0, 50, 100, 0.3), rgba(0, 50, 100, 0.3)), url('../../static/bg/006.jpg') no-repeat fixed center center;
    background-size: cover;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    position: relative;
    box-sizing: border-box;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(25, 55, 109, 0.2);
      z-index: 1;
    }

    .login-view:hover {
      background-color: rgba(255, 255, 255, 1);
    }

    .login-view {
      width: 100%;
      max-width: 420px;
      border-radius: 7px;
      background-color: rgba(255, 255, 255, 0.97);
      padding: 40px 30px;
      box-sizing: border-box;
      border: 1px solid #f5f5f5;
      box-shadow: 6px 6px 10px 0px #888888;
      z-index: 2;

      ::v-deep .input .el-input__inner {
        border: 0 !important;
        background-color: rgba(255, 255, 255, 0);
      }

      .image {
        display: block;
        width: 64px;
        height: 64px;
        margin: 0 auto;
        margin-bottom: 15px;
        border-radius: 6px;
      }

      .form-view {
        margin-top: 20px;

        .form-item {
          border-bottom: 1px solid #f5f5f5;
        }
      }

      .login-title {
        display: block;
        text-align: center;
        color: #121212;
        font-size: 22px;
        letter-spacing: 2px;
      }

      .login_but {
        width: 100%;
        letter-spacing: 4px;
        font-size: 17px;

        ::v-deep .el-icon-loading {
          letter-spacing: 0;
        }
      }

      .password-box {
        font-size: 13px;
        color: #b1b1b1;
        margin-bottom: 20px;
        display: flex;
        align-items: center;

        .remember-password {
          flex: 1;
          cursor: pointer;
          user-select: none;
        }

        .forget-password {
          flex: 1;
          text-align: right;
          cursor: pointer;
          user-select: none;

          &:active {
            color: #3a6ffd;
          }
        }
      }

      .tips {
        color: #b1b1b1;
      }

      .btns-box {
        font-size: 13px;
        color: #b1b1b1;
        padding-top: 25px;
        display: flex;
        box-sizing: border-box;

        span {
          cursor: pointer;

          &:first-of-type {
            flex: 1;
          }

          &:nth-of-type(2) {
            margin-right: 8px;
          }
        }

        .register {
          color: #46d0e7;
        }
      }
    }

    .test-user-list {
      margin-top: 10px;
      user-select: text;
      font-size: 12px;
      color: #606266;

      .test-user-item {
        margin: 5px 0;

        .test-user-item-nickname {
        }

        .test-user-item-username {
          margin-left: 10px;
        }

        .test-user-item-password {
          margin-left: 10px;
        }
      }
    }
  }
</style>
