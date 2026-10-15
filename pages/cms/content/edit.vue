<template>
  <view class="app">
    <view class="vk-page-card">
      <vk-data-page-header :title="pageTitle" :sub-title="model.name">
        <template #right>
          <view>aaa</view>
          <view>bbb</view>
        </template>
      </vk-data-page-header>
      <!-- 表单组件仅封装 vk-data-form，字段按模型 fields 动态生成，键名与内容云函数一致 -->
      <cms-content-form
        ref="contentForm"
        v-model="formData"
        :model="model"
        :form-type="formType"
        :extra-data="extraData"
        :footer-show="false"
        @success="onFormSuccess"
      ></cms-content-form>
      <view style="height: 60px"></view>
    </view>
    <view class="page-footer">
      <el-button @click="goBack">返回</el-button>
      <el-button type="primary" @click="submitForm">保存</el-button>
    </view>
  </view>
</template>

<script>
  let vk = uni.vk;
  export default {
    data() {
      return {
        model: {},
        formData: {},
        formType: 'add',
        extraData: {},
        pageTitle: '内容编辑',
      };
    },
    onLoad(options = {}) {
      vk = this.vk;
      this.options = options;
      this.init(options);
    },
    methods: {
      async init(options) {
        let { id, model_id, locale } = options;
        try {
          let modelRes = await vk.callFunction({
            url: 'admin/cms/sys.model.getInfo',
            title: '加载中',
            data: {
              _id: model_id,
            },
          });

          this.model = modelRes.info;

          if (id) {
            // 编辑：内容数据自身携带所属模型，model_id 仅作为缺省兜底
            let res = await vk.callFunction({
              url: 'admin/cms/content/sys/getInfo',
              title: '加载中',
              data: {
                _id: id,
              },
            });

            this.pageTitle = '编辑';
            this.formType = 'update';
            this.formData = res.info;
          } else {
            // 新增：所属模型由列表页通过参数指定，locale 注入表单默认数据
            this.pageTitle = '新增';
            this.formType = 'add';
            if (vk.pubfn.isNotNull(locale)) {
              this.extraData = {
                locale,
              };
            }
            this.formData = { model_id };
          }
        } catch (err) {
          console.log('失败', err);
          // vk.navigateBack();
        }
      },
      submitForm() {
        this.$refs.contentForm.submit();
      },
      onFormSuccess() {
        this.goBack();
      },
      goBack() {
        vk.navigateBack();
      },
    },
  };
</script>

<style lang="scss" scoped></style>
