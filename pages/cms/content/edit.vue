<template>
  <view class="app">
    <view class="vk-page-card">
      <vk-data-page-header :title="pageTitle" :sub-title="model.name">
        <template #right>
          <el-select v-if="isInternationalization" :value="currentLocale" size="small" class="locale-select" @change="onLocaleChange">
            <el-option v-for="opt in localeOptions" :key="opt.value" :label="opt.label" :value="opt.value"></el-option>
          </el-select>
        </template>
      </vk-data-page-header>
      <vk-data-form
        ref="contentForm"
        v-model="formData"
        :action="formAction"
        :form-type="mode"
        :columns="formColumns"
        :rules="formRules"
        :footer-show="false"
        @success="onFormSuccess"
      ></vk-data-form>
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
        // 页面模式：'add' 新增 / 'update' 编辑（切换语言后若该语言无内容会变为 'add'）
        mode: 'add',
        // 内容文档公共标识，同一内容的多语言版本共用
        documentId: '',
        modelId: '',
        // 语言候选清单（多语言模型下用于切换内容语言）
        localeOptions: [],
      };
    },
    computed: {
      currentLocale() {
        // 当前内容语言：Vuex 持久化，列表页与编辑页共享，切换模型后依然保留
        return vk.getVuex('$app.locale');
      },
      isInternationalization() {
        return !!(this.model && this.model.internationalization);
      },
      pageTitle() {
        return this.mode === 'update' ? '编辑' : '新增';
      },
      formAction() {
        return 'admin/cms/sys.content.' + (this.mode === 'update' ? 'update' : 'add');
      },
      formColumns() {
        return vk.myfn.buildFormConfig({ model: this.model }).columns;
      },
      formRules() {
        return vk.myfn.buildFormConfig({ model: this.model }).rules;
      },
    },
    onLoad(options = {}) {
      vk = this.vk;
      this.options = options;
      this.init(options);
    },
    methods: {
      async init(options = {}) {
        let { mode, model_id, document_id, locale } = options;
        this.mode = mode === 'update' ? 'update' : 'add';
        this.modelId = model_id || '';
        this.documentId = document_id || '';
        try {
          await this.loadModel();
          if (this.isInternationalization) {
            await this.loadLocaleOptions();
          }
          let initLocale = vk.pubfn.isNotNull(locale) ? locale : this.currentLocale;
          if (vk.pubfn.isNull(initLocale)) initLocale = this.getDefaultLocale();
          if (this.isInternationalization && vk.pubfn.isNotNull(initLocale)) vk.setVuex('$app.locale', initLocale);
          if (this.mode === 'update' && vk.pubfn.isNotNull(this.documentId)) {
            await this.loadContent(initLocale);
          } else {
            this.resetForm(initLocale);
          }
        } catch (err) {
          console.error('初始化失败', err);
        }
      },
      // 加载模型配置：始终按 model_id 拉取最新定义
      // Vuex 中的模型是会被持久化的完整快照，字段在模型管理里增删改后会过期，
      // 直接复用会导致新增字段不出现在表单中
      async loadModel() {
        let storeModel = vk.getVuex('$app.model') || {};
        if (vk.pubfn.isNull(this.modelId)) {
          this.model = storeModel;
          return;
        }
        let info = null;
        try {
          let res = await vk.callFunction({
            url: 'admin/cms/sys.model.getInfo',
            data: { id: this.modelId },
          });
          info = res.info;
        } catch (err) {
          console.error('加载模型失败', err);
        }
        if (info && info._id) {
          this.model = info;
          // 回写最新定义，供列表页与后续页面复用
          vk.setVuex('$app.model', info);
          return;
        }
        // 拉取失败时退化为列表页写入的当前模型
        if (storeModel._id === this.modelId) this.model = storeModel;
      },
      async loadContent(locale) {
        let data = { document_id: this.documentId };
        if (this.isInternationalization) data.locale = locale;
        let res = await vk.callFunction({
          url: 'admin/cms/sys.content.getInfo',
          title: '加载中',
          data,
        });
        // 该语言下还没有内容，清空表单按新增处理（保存时沿用同一 document_id）
        if (!res.info || vk.pubfn.isNull(res.info._id)) {
          this.resetForm(locale);
          return false;
        }
        this.mode = 'update';
        this.formData = res.info;
        return true;
      },
      resetForm(locale) {
        this.mode = 'add';
        // vk-data-form 不会自动应用列上的 defaultValue，新增时必须显式拼入模型字段默认值
        let formData = vk.myfn.buildFormDefaultData({ model: this.model });
        formData.model_id = this.modelId || this.model._id;
        if (vk.pubfn.isNotNull(this.documentId)) formData.document_id = this.documentId;
        if (this.isInternationalization && vk.pubfn.isNotNull(locale)) formData.locale = locale;
        this.formData = formData;
      },
      async loadLocaleOptions() {
        let res = await vk.callFunction({
          url: 'admin/setting/sys.i18n.select',
        });
        this.localeOptions = res.list || [];
      },
      getDefaultLocale() {
        let defaultOpt = this.localeOptions.find((opt) => opt.is_default);
        if (defaultOpt) return defaultOpt.value;
        return this.localeOptions.length > 0 ? this.localeOptions[0].value : '';
      },
      async onLocaleChange(val) {
        // 语言是内容维度的公共状态：编辑页切换后写回 Vuex，列表页语言也随之切换
        vk.setVuex('$app.locale', val);
        // 尚未保存的新增内容，切换语言只影响自身表单数据
        if (vk.pubfn.isNull(this.documentId)) {
          this.$set(this.formData, 'locale', val);
          return;
        }
        await this.loadContent(val);
      },
      submitForm() {
        this.$refs.contentForm.submitForm();
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

<style lang="scss" scoped>
  .locale-select {
    width: 160px;
  }
</style>
