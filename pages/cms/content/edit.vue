<template>
  <view class="content-edit-page">
    <!-- 左侧：内容表单 -->
    <view class="content-edit-main">
      <view class="vk-page-card">
        <vk-data-page-header :title="pageTitle" :sub-title="model.name" show-back @back="goBack">
          <template #right>
            <el-select v-if="isInternationalization" :value="currentLocale" size="small" class="locale-select" @change="onLocaleChange">
              <el-option v-for="opt in localeOptions" :key="opt.value" :label="opt.label" :value="opt.value"></el-option>
            </el-select>
          </template>
        </vk-data-page-header>
        <!-- 开启草稿箱的模型：草稿 / 发布 双记录标签页，已发布记录不存在时发布页禁用 -->
        <view v-if="hasDraftBox" class="status-tabs">
          <el-tabs v-model="activeTab" @tab-click="onTabClick">
            <el-tab-pane label="草稿" name="draft"></el-tab-pane>
            <el-tab-pane label="发布" name="publish" :disabled="!hasPublished"></el-tab-pane>
          </el-tabs>
        </view>
        <vk-data-form
          ref="contentForm"
          v-model="formData"
          :action="formAction"
          :form-type="mode"
          :columns="formColumns"
          :rules="formRules"
          :disabled="formReadOnly"
          :footer-show="false"
          @success="onFormSuccess"
          @loading="onFormLoading"
        ></vk-data-form>
        <view style="height: 20px"></view>
      </view>
    </view>
    <!-- 右侧：固定操作区（不随表单滚动） -->
    <view class="content-edit-side">
      <view class="side-card">
        <view class="side-title">操作</view>
        <view v-if="hasDraftBox" class="side-status">
          <span class="side-status-label">当前查看</span>
          <el-tag :type="activeTab === 'publish' ? 'success' : 'info'" size="small">{{ activeTab === 'publish' ? '已发布' : '草稿' }}</el-tag>
        </view>
        <el-button v-if="isUpdate" class="side-btn" icon="el-icon-view" @click="onPreview">预览</el-button>
        <el-button v-if="hasDraftBox" class="side-btn" :loading="formLoading" :disabled="formReadOnly" @click="submit('draft')">保存</el-button>
        <el-button type="primary" class="side-btn" :loading="formLoading" :disabled="formReadOnly" @click="submit('publish')">发布</el-button>
        <view v-if="hasDraftBox" class="side-tip">{{ formReadOnly ? '已发布版本只读，请切换到「草稿」继续编辑' : '「保存」写入草稿，「发布」会把草稿同步为已发布记录' }}</view>
      </view>
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
        // 当前标签页对应记录是否存在：'add' 该组合下新增 / 'update' 编辑
        mode: 'add',
        // 逻辑内容标识：一条内容由 document_id 关联，每个语言、每种状态各一条记录
        documentId: '',
        modelKey: '',
        // 语言候选清单（多语言模型下用于切换内容语言）
        localeOptions: [],
        // 草稿箱模型的当前状态标签页：'draft' / 'publish'
        activeTab: 'draft',
        // 当前 document_id + locale 是否已存在已发布记录（决定「发布」标签页是否可点）
        hasPublished: false,
        // 已发布记录数据：草稿缺失时用它预填草稿表单，避免空白草稿覆盖已发布内容
        publishedInfo: null,
        formLoading: false,
        // 本次提交意图：draft 保存草稿 / publish 发布
        submitKind: '',
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
      // 模型是否开启草稿箱
      hasDraftBox() {
        return !!(this.model && this.model.draft);
      },
      isUpdate() {
        return this.mode === 'update';
      },
      // 已发布标签页只读
      formReadOnly() {
        return this.hasDraftBox && this.activeTab === 'publish';
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
        // URL 参数：document_id 或 id（值都必须是 document_id，不再使用记录 _id）
        let { model_key, document_id, id, locale, tab } = options;
        this.modelKey = model_key || '';
        this.documentId = document_id || id || '';
        this.activeTab = tab === 'publish' ? 'publish' : 'draft';
        try {
          await this.loadModel();
          if (this.isInternationalization) {
            await this.loadLocaleOptions();
          }
          let initLocale = vk.pubfn.isNotNull(locale) ? locale : this.currentLocale;
          if (vk.pubfn.isNull(initLocale)) initLocale = this.getDefaultLocale();
          if (this.isInternationalization && vk.pubfn.isNotNull(initLocale)) vk.setVuex('$app.locale', initLocale);
          // 没有 document_id 视为全新内容，按新增处理
          if (vk.pubfn.isNull(this.documentId)) {
            this.resetForm(initLocale, false);
            return;
          }
          await this.refreshPublishedFlag();
          if (this.hasDraftBox && this.activeTab === 'publish' && !this.hasPublished) this.activeTab = 'draft';
          await this.loadTab(this.activeTab, initLocale);
        } catch (err) {
          console.error('初始化失败', err);
        }
      },
      // 加载模型配置：始终按 model_key 拉取最新定义
      // Vuex 中的模型是会被持久化的完整快照，字段在模型管理里增删改后会过期，
      // 直接复用会导致新增字段不出现在表单中
      async loadModel() {
        let storeModel = vk.getVuex('$app.model') || {};
        if (vk.pubfn.isNull(this.modelKey)) {
          this.model = storeModel;
          return;
        }
        let info = null;
        try {
          let res = await vk.callFunction({
            url: 'admin/cms/sys.model.getInfo',
            data: { key: this.modelKey },
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
        if (storeModel.key === this.modelKey) this.model = storeModel;
      },
      /**
       * 按 document_id + locale + status 精确加载当前标签页对应的记录
       * @param {String} locale 语言
       * @param {Boolean} status 草稿 false / 已发布 true；未开草稿箱的模型不传，保持旧的单条语义
       * @param {String} title loading 文案
       */
      async fetchContent(locale, status, title = '加载中') {
        let data = { document_id: this.documentId };
        if (this.isInternationalization) data.locale = locale;
        if (this.hasDraftBox) data.status = status;
        let res = await vk.callFunction({
          url: 'admin/cms/sys.content.getInfo',
          title,
          data,
        });
        if (res.code !== 0) {
          vk.toast(res.msg || '加载失败');
          return null;
        }
        return res.info && vk.pubfn.isNotNull(res.info._id) ? res.info : null;
      },
      /**
       * 切换标签页数据：组合不存在时进入该组合下的新增态（保留同一个 document_id 与 locale）
       */
      async loadTab(tab, locale) {
        let status = this.hasDraftBox ? tab === 'publish' : undefined;
        let info = await this.fetchContent(locale, status);
        if (info) {
          this.mode = 'update';
          this.formData = info;
          this.documentId = info.document_id || this.documentId;
          if (tab === 'publish') this.publishedInfo = info;
          return true;
        }
        // 已发布标签页必须有记录，缺失时回退到草稿
        if (this.hasDraftBox && tab === 'publish') {
          this.hasPublished = false;
          this.activeTab = 'draft';
          vk.toast('已发布记录不存在，请先保存草稿后发布');
          await this.loadTab('draft', locale);
          return false;
        }
        // 草稿组合不存在但已发布存在：以已发布内容预填草稿，避免空白表单保存后把已发布内容覆盖为空
        if (this.hasDraftBox && tab === 'draft' && this.hasPublished) {
          let published = this.publishedInfo || (await this.fetchContent(locale, true, ''));
          if (published) {
            this.publishedInfo = published;
            this.resetFormFromPublished(locale, published);
            return false;
          }
        }
        this.resetForm(locale, status);
        return false;
      },
      // 查询当前 document_id + locale 是否已有已发布记录
      async refreshPublishedFlag() {
        if (!this.hasDraftBox || vk.pubfn.isNull(this.documentId)) {
          this.hasPublished = false;
          return false;
        }
        let info = await this.fetchContent(this.currentLocale, true, '');
        this.publishedInfo = info || null;
        this.hasPublished = !!info;
        return this.hasPublished;
      },
      resetForm(locale, status) {
        this.mode = 'add';
        // vk-data-form 不会自动应用列上的 defaultValue，新增时必须显式拼入模型字段默认值
        let formData = vk.myfn.buildFormDefaultData({ model: this.model });
        formData.model_key = this.modelKey || this.model.key;
        if (vk.pubfn.isNotNull(this.documentId)) formData.document_id = this.documentId;
        if (this.isInternationalization && vk.pubfn.isNotNull(locale)) formData.locale = locale;
        // 草稿箱模型按当前标签页写入状态；未开草稿箱固定为已发布
        formData.status = this.hasDraftBox ? status === true : true;
        this.formData = formData;
      },
      /**
       * 用已发布内容预填草稿表单：仍处于该组合下的新增态（mode=add），
       * 但表单内容与已发布版本一致，保存时新建草稿行而不是覆盖已发布行
       */
      resetFormFromPublished(locale, published = {}) {
        this.resetForm(locale, false);
        // 记录级系统字段不复制：尤其不能带 _id，否则 update 会直接改到已发布行
        let excludeKeys = [
          '_id',
          '_openid',
          '_add_time',
          '_add_time_str',
          '_update_time',
          '_update_time_str',
          'model_key',
          'document_id',
          'locale',
          'status',
          'created_by_id',
          'updated_by_id',
          'user_id',
          'model',
        ];
        Object.keys(published).forEach((key) => {
          if (excludeKeys.indexOf(key) === -1) this.$set(this.formData, key, published[key]);
        });
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
        // 尚未保存的全新内容，切换语言只影响自身表单数据
        if (vk.pubfn.isNull(this.documentId)) {
          this.$set(this.formData, 'locale', val);
          return;
        }
        // 语言切换后按 document_id + locale（+ 当前标签页状态）重新定位
        await this.refreshPublishedFlag();
        if (this.hasDraftBox && this.activeTab === 'publish' && !this.hasPublished) this.activeTab = 'draft';
        await this.loadTab(this.activeTab, val);
      },
      // 用户点击顶部标签页：按新的标签页状态取对应记录
      async onTabClick(tab) {
        let name = tab && tab.name ? tab.name : this.activeTab;
        if (name === 'publish' && !this.hasPublished) return;
        this.activeTab = name;
        await this.loadTab(name, this.currentLocale);
      },
      /**
       * 提交表单
       * @param {String} kind draft 保存草稿 / publish 发布
       */
      submit(kind) {
        if (this.formLoading || this.formReadOnly) return;
        this.submitKind = kind;
        // 草稿箱模型：保存与发布都先写草稿行（status:false），发布随后再复制为已发布行；未开草稿箱固定写已发布
        let status = this.hasDraftBox ? false : true;
        this.$refs.contentForm.submitForm({
          data: { status },
        });
      },
      onFormLoading(val) {
        this.formLoading = !!val;
      },
      async onFormSuccess(payload = {}) {
        let response = payload.data || {};
        let kind = this.submitKind;
        this.submitKind = '';
        // 新增成功：补齐 document_id 后，以 document_id 进入该内容的编辑页
        if (this.mode === 'add') {
          this.documentId = response.document_id || this.documentId;
          if (vk.pubfn.isNull(this.documentId)) {
            vk.toast('保存成功');
            this.goBack();
            return;
          }
          if (this.hasDraftBox && kind === 'publish') {
            let published = await this.doPublish();
            if (!published) return;
          }
          this.redirectToEdit(this.hasDraftBox && kind === 'publish' ? 'publish' : 'draft');
          return;
        }
        // 编辑态发布：草稿行已随表单保存，再把草稿复制为已发布行
        if (this.hasDraftBox && kind === 'publish') {
          let published = await this.doPublish();
          if (!published) return;
          this.hasPublished = true;
          this.activeTab = 'publish';
          await this.loadTab('publish', this.currentLocale);
          return;
        }
        // 编辑态保存：重新拉取当前草稿数据
        await this.loadTab('draft', this.currentLocale);
      },
      // 发布：由后端把草稿行复制/覆盖到已发布行
      async doPublish() {
        let data = { document_id: this.documentId };
        if (this.isInternationalization) data.locale = this.currentLocale;
        let res = await vk.callFunction({
          url: 'admin/cms/sys.content.publish',
          title: '发布中',
          data,
        });
        if (res.code !== 0) {
          vk.toast(res.msg || '发布失败');
          return false;
        }
        return true;
      },
      redirectToEdit(tab) {
        let url = '/pages/cms/content/edit?mode=update&model_key=' + this.modelKey + '&document_id=' + this.documentId;
        if (this.isInternationalization && vk.pubfn.isNotNull(this.currentLocale)) {
          url += '&locale=' + encodeURIComponent(this.currentLocale);
        }
        if (this.hasDraftBox && tab === 'publish') url += '&tab=publish';
        vk.redirectTo(url);
      },
      onPreview() {
        // 预览功能本次仅保留入口
        vk.toast('预览功能开发中');
      },
      goBack() {
        vk.navigateBack();
      },
    },
  };
</script>

<style lang="scss" scoped>
  .content-edit-page {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .content-edit-main {
    flex: 1;
    min-width: 0;
  }

  .content-edit-side {
    flex: 0 0 220px;
    width: 220px;
    position: sticky;
    top: 10px;
  }

  .side-card {
    background: #fff;
    border-radius: 4px;
    padding: 16px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  }

  .side-title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 12px;
  }

  .side-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    font-size: 13px;
    color: #606266;
  }

  .side-btn {
    width: 100%;
    margin-left: 0 !important;
    margin-bottom: 10px;
  }

  .side-tip {
    font-size: 12px;
    color: #909399;
    line-height: 1.6;
    margin-top: 4px;
  }

  .status-tabs ::v-deep .el-tabs__header {
    margin-bottom: 8px;
  }

  .locale-select {
    width: 160px;
  }
</style>
