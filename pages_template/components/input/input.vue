<template>
  <div class="page">
    <!-- 页面内容开始 -->
    <vk-data-page-header title="Input 表单输入" subTitle="聚合输入框"></vk-data-page-header>
    <div class="page-body">
      <div class="tips">根据type自动渲染的不同的输入框（不建议数字和文本输入框互切）</div>
      <div class="mt15">
        <el-radio-group v-model="type">
          <el-radio label="number">数字输入框</el-radio>
          <el-radio label="money">金额输入框</el-radio>
          <el-radio label="percentage">百分比输入框</el-radio>
          <el-radio label="discount">折扣输入框</el-radio>
          <el-radio label="number-box">步进器</el-radio>
          <el-radio label="textarea">多行文本输入框</el-radio>
        </el-radio-group>
      </div>
      <div class="mt15">
        <vk-data-input :type="type" v-model="form1.value" :precision="2" width="300px" placeholder="请输入"></vk-data-input>
      </div>
      <div class="mt15 json-view" v-if="form1">
        <pre>{{ form1 }}</pre>
      </div>
      <div class="mt15 tips">根据 mode 切换 vk-data-input-numeric 的数值模式</div>
      <div class="mt15">
        <el-radio-group v-model="mode">
          <el-radio label="number">数字输入框</el-radio>
          <el-radio label="money">金额输入框</el-radio>
          <el-radio label="percentage">百分比输入框</el-radio>
          <el-radio label="discount">折扣输入框</el-radio>
        </el-radio-group>
      </div>
      <div class="mt15">
        <el-radio-group v-model="range" @change="onRangeChange">
          <el-radio :label="false">单值输入</el-radio>
          <el-radio :label="true">双值范围</el-radio>
          <el-radio :label="3">三值输入</el-radio>
        </el-radio-group>
      </div>
      <div class="mt15">
        <vk-data-input-numeric
          :mode="mode"
          v-model="form2.value"
          :range="range"
          :precision="2"
          :allow-negative="true"
          :width="numericInputConfig.width"
          :placeholder="numericInputConfig.placeholder"
        ></vk-data-input-numeric>
      </div>
      <div class="mt15 tips" v-if="range !== false">
        范围值以数组形式保存，允许单侧留空或分别清除，不自动调整输入顺序。
      </div>
      <div class="mt15 json-view" v-if="form2">
        <pre>{{ form2 }}</pre>
      </div>
    </div>
    <!-- 页面内容结束 -->
  </div>
</template>

<script>
  let that; // 当前页面对象
  let vk = uni.vk; // vk实例
  export default {
    data() {
      // 页面数据变量
      return {
        // 表单请求数据
        form1: {
          value: null,
        },
        form2: {
          value: null,
        },
        type: 'number',
        mode: 'number',
        range: false,
      };
    },
    // 监听 - 页面每次【加载时】执行(如：前进)
    onLoad(options = {}) {
      that = this;
      vk = that.vk;
      that.options = options;
      that.init(options);
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
      // 切换输入形式时保留已有项，新增项补空，单值取第一项
      onRangeChange(range) {
        const values = Array.isArray(this.form2.value) ? this.form2.value : [this.form2.value];
        if (range === false) {
          this.form2.value = values[0];
          return;
        }
        const count = range === true ? 2 : range;
        this.form2.value = Array.from({ length: count }, (_, index) => (index < values.length ? values[index] : null));
      },
    },
    // 计算属性
    computed: {
      numericInputConfig() {
        if (this.range === true) {
          return { width: '500px', placeholder: ['最小值', '最大值'] };
        }
        if (this.range === 3) {
          return { width: '700px', placeholder: ['第一个值', '第二个值', '第三个值'] };
        }
        return { width: '300px', placeholder: '请输入' };
      },
    },
  };
</script>
<style lang="scss" scoped>
  .json-view pre {
    font-family: Consolas, 'Courier New', monospace;
  }
</style>
