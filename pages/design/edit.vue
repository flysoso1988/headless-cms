<template>
  <view class="page-body">
    <el-container>
      <el-header height="50px" style="border-bottom: 1px solid #eee">
        <el-page-header @back="goBack" content="详情页面"></el-page-header>
        <div class="actions">
          <el-button size="mini" type="primary">保存</el-button>
        </div>
      </el-header>
      <el-container>
        <el-aside width="300px">
          <el-tabs tab-position="left" style="height: 100%">
            <el-tab-pane label="组件">组件</el-tab-pane>
            <el-tab-pane label="模板">模板</el-tab-pane>
            <el-tab-pane label="结构">结构</el-tab-pane>
            <el-tab-pane label="历史">历史</el-tab-pane>
            <el-tab-pane label="AI">AI</el-tab-pane>
          </el-tabs>
        </el-aside>
        <el-main>Main</el-main>
        <el-aside width="300px">Aside</el-aside>
      </el-container>
    </el-container>
  </view>
</template>

<script>
  let vk = uni.vk; // vk实例
  export default {
    data() {
      return {
        config: {
          component: {
            div: {},
          },
          root: {},
        },
      };
    },
    // 监听 - 页面每次【加载时】执行(如：前进)
    onLoad(options = {}) {
      vk = this.vk;
      this.options = options;
      this.init(options);
    },
    // 监听 - 页面【首次渲染完成时】执行。注意如果渲染速度快，会在页面进入动画完成前触发
    onReady() {},
    // 监听 - 页面每次【显示时】执行(如：前进和返回) (页面每次出现在屏幕上都触发，包括从下级页面点返回露出当前页面)
    onShow() {},
    // 监听 - 页面每次【隐藏时】执行(如：返回)
    onHide() {},
    // 函数
    methods: {
      // 页面数据初始化函数
      init(options) {},
      // 页面跳转
      pageTo(path) {
        vk.navigateTo(path);
      },
    },
    // 计算属性
    computed: {},
  };
</script>
<style lang="scss" scoped>
  .page-body {
    padding: 0;
    height: 100vh;
  }
  .el-container {
    height: 100%;
  }
  .el-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .el-main {
    background-color: #f8f8f8;
    height: 100%;
  }
</style>
