<template>
  <view class="content-edit-page" :class="{ 'is-readonly': formReadOnly }">
    <!-- 左侧：内容表单 -->
    <view class="content-edit-main">
      <view class="editor-card" :class="{ 'has-tabs': hasDraftBox }">
        <vk-data-page-header :title="pageTitle" :sub-title="model.name" :bottom="0" class="editor-page-header">
          <view class="editor-title-row">
            <el-button class="header-back-btn" size="mini" icon="el-icon-back" @click="goBack">{{ $t('vk.common.back') }}</el-button>
            <span class="editor-title-text">{{ pageTitle }}</span>
          </view>
          <template #sub-title>
            <span v-if="model.name" class="model-chip">{{ model.name }}</span>
          </template>
          <template #right>
            <view class="header-actions">
              <el-select v-if="isInternationalization" :value="currentLocale" size="small" class="locale-select" @change="onLocaleChange">
                <el-option v-for="opt in localeOptions" :key="opt.value" :label="opt.label" :value="opt.value"></el-option>
              </el-select>
            </view>
          </template>
        </vk-data-page-header>
        <!-- 开启草稿箱的模型：草稿 / 发布 双记录标签页，已发布记录不存在时发布页禁用 -->
        <view v-if="hasDraftBox" class="status-tabs">
          <el-tabs v-model="activeTab" @tab-click="onTabClick">
            <el-tab-pane label="草稿" name="draft"></el-tab-pane>
            <el-tab-pane label="发布" name="publish" :disabled="!hasPublished"></el-tab-pane>
          </el-tabs>
        </view>
        <view class="editor-body">
          <!-- 只读态提示：仅表达当前查看状态，不复用旧的标签页提示文案 -->
          <view v-if="formReadOnly" class="readonly-notice">
            <i class="el-icon-lock"></i>
            <span>当前为已发布版本，内容只读</span>
          </view>
          <vk-data-form
            ref="contentForm"
            class="editor-form"
            v-model="formData"
            :action="formAction"
            :form-type="mode"
            :columns="formColumns"
            :rules="formRules"
            :disabled="formReadOnly"
            :footer-show="false"
            label-width="120px"
            @success="onFormSuccess"
            @loading="onFormLoading"
          ></vk-data-form>
        </view>
      </view>
    </view>
    <!-- 右侧：固定操作区（不随表单滚动） -->
    <view class="content-edit-side">
      <view class="side-card">
        <view class="side-header">
          <span class="side-title">操作</span>
        </view>
        <view v-if="hasDraftBox" class="side-status">
          <span class="side-status-label">当前查看</span>
          <el-tag :type="activeTab === 'publish' ? 'success' : 'info'" size="small">{{ activeTab === 'publish' ? '已发布' : '草稿' }}</el-tag>
        </view>
        <view class="side-actions">
          <el-button v-if="isUpdate" class="side-preview-btn" type="text" icon="el-icon-view" @click="onPreview">预览</el-button>
          <el-button v-if="hasDraftBox" class="side-btn" size="medium" :loading="formLoading" :disabled="formReadOnly" @click="submit('draft')">保存</el-button>
          <el-button type="primary" class="side-btn side-btn-publish" size="medium" :loading="formLoading" :disabled="formReadOnly" @click="submit('publish')">发布</el-button>
        </view>
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
    /* 页面级间距与语义色变量：同页取值统一收敛，避免散落的魔法数字 */
    --ce-space-1: 4px;
    --ce-space-2: 8px;
    --ce-space-3: 12px;
    --ce-space-4: 16px;
    --ce-space-5: 20px;
    --ce-text-primary: #303133;
    --ce-text-secondary: #606266;
    --ce-text-muted: #909399;
    --ce-primary: #409eff;
    --ce-border: #ebeef5;
    --ce-border-soft: #f2f4f7;
    --ce-surface: #ffffff;
    --ce-surface-muted: #f8f9fb;
    --ce-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
    --ce-radius: var(--border-radius, 6px);

    display: flex;
    align-items: flex-start;
    gap: var(--ce-space-4);
  }

  .content-edit-main {
    flex: 1 1 auto;
    min-width: 0;
  }

  .content-edit-side {
    flex: 0 0 260px;
    position: sticky;
    top: var(--ce-space-4);
  }

  .editor-card {
    overflow: hidden;
    border: 1px solid var(--ce-border);
    border-radius: var(--ce-radius);
    background: var(--ce-surface);
    box-shadow: var(--ce-shadow);
  }

  /* 提高选择器权重，稳定覆盖组件自带的头部高度与内边距 */
  .content-edit-page .editor-page-header {
    height: auto;
    padding: var(--ce-space-4) var(--ce-space-5) var(--ce-space-3);
    border-bottom: none;
  }

  .content-edit-page .editor-page-header ::v-deep .header-title {
    display: flex;
    align-items: center;
    gap: var(--ce-space-3);
    color: var(--ce-text-primary);
    font-size: 20px;
    font-weight: 600;
  }

  .content-edit-page .editor-page-header ::v-deep .header-sub-title {
    margin-top: 0;
    margin-left: var(--ce-space-3);
  }

  /* 模型名做成弱化 chip，与页面标题形成主次层级 */
  .model-chip {
    display: inline-block;
    max-width: 180px;
    padding: 2px 8px;
    overflow: hidden;
    border-radius: 10px;
    background: var(--ce-surface-muted);
    color: var(--ce-text-secondary);
    font-size: 12px;
    line-height: 18px;
    text-overflow: ellipsis;
    vertical-align: middle;
    white-space: nowrap;
  }

  .editor-title-row {
    display: flex;
    align-items: center;
    gap: var(--ce-space-3);
  }

  .editor-title-text {
    color: var(--ce-text-primary);
    font-size: 20px;
    font-weight: 600;
    line-height: 1.4;
  }

  .content-edit-page .header-back-btn {
    height: 26px;
    padding: 0 9px;
    border-color: var(--ce-border);
    border-radius: 4px;
    background: var(--ce-surface);
    color: var(--ce-text-secondary);
    font-size: 13px;
    font-weight: 400;
    line-height: 24px;
  }

  .content-edit-page .header-back-btn:hover,
  .content-edit-page .header-back-btn:focus {
    border-color: var(--ce-primary);
    color: var(--ce-primary);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--ce-space-2);
  }

  .locale-select {
    width: 160px;
  }

  /* 无标签页时由头部自身承担分隔线，避免与标签条底部线条重复 */
  .editor-card:not(.has-tabs) .editor-page-header {
    border-bottom: 1px solid var(--ce-border-soft);
  }

  .status-tabs {
    padding: 0 var(--ce-space-5);
    border-bottom: 1px solid var(--ce-border-soft);
  }

  .status-tabs ::v-deep .el-tabs__header {
    margin: 0;
  }

  .status-tabs ::v-deep .el-tabs__nav-wrap::after {
    display: none;
  }

  .status-tabs ::v-deep .el-tabs__item {
    height: 46px;
    margin-right: var(--ce-space-5);
    padding: 0 2px;
    color: var(--ce-text-secondary);
    font-size: 14px;
    line-height: 46px;
  }

  .status-tabs ::v-deep .el-tabs__item.is-active {
    color: var(--ce-text-primary);
    font-weight: 600;
  }

  .status-tabs ::v-deep .el-tabs__item.is-disabled {
    color: #c0c4cc;
    font-weight: 400;
  }

  .status-tabs ::v-deep .el-tabs__active-bar {
    height: 2px;
    border-radius: 2px;
    background-color: var(--ce-primary);
  }

  .editor-body {
    background: var(--ce-surface);
  }

  /* 只读态：表单区整体降一档底色，配合只读提示与弱化 label 表达查看状态 */
  .is-readonly .editor-body {
    background: var(--ce-surface-muted);
  }

  .readonly-notice {
    display: flex;
    align-items: center;
    gap: var(--ce-space-2);
    margin: var(--ce-space-4) var(--ce-space-5) 0;
    padding: 10px 14px;
    border: 1px solid #faecd8;
    border-radius: 4px;
    background: #fdf6ec;
    color: #b88230;
    font-size: 13px;
    line-height: 1.5;
  }

  .readonly-notice i {
    font-size: 14px;
  }

  /* 覆盖万能表单自带的 30px 内边距，与头部、标签条保持同一横向留白 */
  .editor-body .editor-form ::v-deep > .el-form {
    padding: var(--ce-space-4) var(--ce-space-5) var(--ce-space-1);
  }

  .is-readonly .editor-form ::v-deep .el-form-item__label {
    color: var(--ce-text-muted);
  }

  .side-card {
    padding: var(--ce-space-4);
    border: 1px solid var(--ce-border);
    border-radius: var(--ce-radius);
    background: var(--ce-surface);
    box-shadow: var(--ce-shadow);
  }

  .side-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: var(--ce-space-3);
    border-bottom: 1px solid var(--ce-border-soft);
  }

  .side-title {
    color: var(--ce-text-primary);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.2px;
  }

  .side-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: var(--ce-space-3) 0 0;
    padding: 10px 12px;
    border-radius: 4px;
    background: var(--ce-surface-muted);
    color: var(--ce-text-secondary);
    font-size: 13px;
  }

  .side-status-label {
    color: var(--ce-text-muted);
  }

  .side-actions {
    display: flex;
    flex-direction: column;
    margin-top: var(--ce-space-4);
    gap: var(--ce-space-2);
  }

  .side-actions ::v-deep .el-button + .el-button {
    margin-left: 0;
  }

  .side-btn {
    width: 100%;
    margin: 0;
  }

  .side-btn-publish {
    letter-spacing: 2px;
  }

  /* 预览为弱化入口：文字按钮，不参与主次按钮的视觉竞争 */
  .side-preview-btn {
    align-self: flex-start;
    padding: 0 var(--ce-space-1);
    color: var(--ce-text-secondary);
    font-size: 13px;
  }

  .side-preview-btn:hover {
    color: var(--ce-primary);
  }

  .side-tip {
    margin-top: var(--ce-space-3);
    padding-top: var(--ce-space-3);
    border-top: 1px solid var(--ce-border-soft);
    color: var(--ce-text-muted);
    font-size: 12px;
    line-height: 1.6;
  }

  /* 窄屏：操作区改为底部吸底条，避免右侧固定列压缩表单宽度 */
  @media screen and (max-width: 1180px) {
    .content-edit-page {
      flex-direction: column;
      align-items: stretch;
      gap: var(--ce-space-3);
    }

    .content-edit-side {
      flex: 0 0 auto;
      width: 100%;
      position: sticky;
      top: auto;
      bottom: var(--ce-space-3);
      z-index: 1;
    }

    .side-card {
      display: flex;
      align-items: center;
      gap: var(--ce-space-3);
      padding: 10px var(--ce-space-4);
      box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.08);
    }

    .side-header {
      display: none;
    }

    .side-status {
      flex: 0 0 auto;
      margin: 0;
      padding: 4px 10px;
      background: transparent;
    }

    .side-status-label {
      display: none;
    }

    .side-actions {
      flex: 1 1 auto;
      flex-direction: row;
      align-items: center;
      justify-content: flex-end;
      margin-top: 0;
    }

    .side-btn {
      width: auto;
      min-width: 88px;
    }

    .side-preview-btn {
      align-self: center;
    }

    .side-tip {
      display: none;
    }
  }

  /* 更窄的窗口：压缩头部与表单留白，按钮等分撑满操作条 */
  @media screen and (max-width: 768px) {
    .content-edit-page .editor-page-header {
      padding: var(--ce-space-3) var(--ce-space-4);
    }

    .content-edit-page .editor-page-header ::v-deep .header-title {
      gap: var(--ce-space-2);
      font-size: 18px;
    }

    .model-chip {
      max-width: 96px;
    }

    .editor-title-text {
      font-size: 18px;
    }

    .locale-select {
      width: 132px;
    }

    .status-tabs {
      padding: 0 var(--ce-space-4);
    }

    .status-tabs ::v-deep .el-tabs__item {
      margin-right: var(--ce-space-4);
    }

    .readonly-notice {
      margin: var(--ce-space-3) var(--ce-space-4) 0;
    }

    .editor-body .editor-form ::v-deep > .el-form {
      padding: var(--ce-space-3) var(--ce-space-4) var(--ce-space-1);
    }
  }

  @media screen and (max-width: 640px) {
    .side-status {
      display: none;
    }

    .side-actions {
      justify-content: space-between;
    }

    .side-btn {
      flex: 1 1 0;
      min-width: 0;
    }

    .side-preview-btn {
      flex: 0 0 auto;
    }
  }
</style>
