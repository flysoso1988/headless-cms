<template>
  <vk-data-dialog v-model="value.show" :title="page.title" top="6vh" width="800px" :close-on-click-modal="false" :destroy-on-close="true" mode="form">
    <vk-data-form ref="formRef" v-model="formData" :rules="form1.rules" :columns="form1.columns" :form-type="value.mode" :footer-show="false" label-width="120px"></vk-data-form>
    <view class="dz-form-footer">
      <el-button size="small" @click="close">取消</el-button>
      <el-button size="small" type="primary" @click="confirm">确定</el-button>
    </view>
  </vk-data-dialog>
</template>

<script>
  let vk = uni.vk;

  export default {
    name: 'cms-dynamic-zone-block-form',
    props: {
      value: {
        type: Object,
        default: () => ({
          show: false,
          mode: 'add',
          item: {},
          options: {},
        }),
      },
    },
    data() {
      return {
        page: { title: '区块' },
        // 表单数据与配置由当前组件模型的字段动态生成
        formData: {},
        form1: {
          columns: [],
          rules: {},
        },
      };
    },
    watch: {
      'value.show'(show) {
        if (show) this.buildForm();
      },
    },
    methods: {
      // 打开时按组件模型的字段重建表单（复用配置生成器）
      buildForm() {
        let { item = {}, options = {} } = this.value;
        let model = options.model || {};
        let index = options.index || 1;
        this.page.title = (model.name || '区块') + ' · 第 ' + index + ' 个区块';
        let config = vk.myfn.buildFormConfig({ model });
        this.form1.columns = config.columns;
        this.form1.rules = config.rules;
        let data = vk.pubfn.copyObject(item);
        delete data.__uid; // 拖拽用的内部标识不进入表单数据
        this.formData = data;
      },
      confirm() {
        if (!this.$refs.formRef) return;
        this.$refs.formRef.validate((valid) => {
          if (!valid) return;
          this.$emit('success', vk.pubfn.copyObject(this.formData));
          this.close();
        });
      },
      close() {
        this.value.show = false;
      },
    },
  };
</script>

<style lang="scss" scoped>
  .dz-form-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid #ebeef5;
  }
</style>
