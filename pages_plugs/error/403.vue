<template>
  <div class="page-body">
    <image src="../../static/icon/icon-403.svg"></image>
    <div class="title">
      <span class="code">403</span>
      <span class="tips">{{ $t('vk.error.noPermissionTips') }}</span>
      <span class="tips">{{ errMsg }}</span>
      <el-button class="btn" type="primary" @click="toHome">{{ $t('vk.error.backToHome') }}</el-button>
    </div>
  </div>
</template>

<script>
  export default {
    data() {
      return {
        errMsg: '',
      };
    },
    onLoad(query) {
      this.errMsg = query.errMsg || '';
    },
    methods: {
      toHome() {
        uni.vk.navigateToHome();
      },
    },
  };
</script>

<style lang="scss" scoped>
  page {
    width: 100%;
    height: 100%;
    background-color: #f5f7f9;
  }
  .page-body {
    display: flex;
    padding-top: 125px;
    justify-content: center;

    .title {
      display: flex;
      flex-direction: column;
      padding-top: 60px;
      margin-left: 100px;
    }
    .code {
      margin-bottom: 24px;
      color: #515a6e;
      font-weight: 600;
      font-size: 72px;
      line-height: 72px;
    }
    .tips {
      margin-bottom: 16px;
      color: #808695;
      font-size: 20px;
      line-height: 28px;
    }
    .btn {
      width: 150px;
    }
  }
</style>
