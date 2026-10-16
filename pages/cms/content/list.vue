<template>
  <view>
    <view class="content-layout">
      <!-- 左侧模型列表 -->
      <view class="content-sidebar">
        <view class="sidebar-search">
          <el-input v-model="searchKeyword" placeholder="搜索模型" prefix-icon="el-icon-search" size="small" clearable @input="filterModels"></el-input>
        </view>
        <view class="model-list">
          <template v-for="group in groupedModels">
            <view class="model-group" :key="group.type">
              <view class="group-header">
                <span class="group-title">{{ group.label }}</span>
                <span class="group-add">{{ group.items.length }}</span>
              </view>
              <view class="group-items">
                <view v-for="item in group.items" :key="item._id" class="model-item" :class="{ active: currentModel._id === item._id }" @click="onModelClick(item)">
                  <span class="model-name">{{ item.name }}</span>
                </view>
              </view>
            </view>
          </template>
          <view v-if="groupedModels.length === 0" class="empty-tip">暂无模型</view>
        </view>
      </view>
      <view class="content-main">
        <template v-if="vk.pubfn.isNotNull(currentModel)">
          <!-- 集合类：内容表格组件（组件内含公共头部与添加按钮） -->
          <cms-content-table v-if="currentModel.type === 'collection'" ref="contentTable" :model="currentModel" @add="onAdd" @update="onUpdate"></cms-content-table>
          <!-- 单页类：公共头部 + 直接显示表单 -->
          <template v-else-if="currentModel.type === 'single'">
            <view class="content-main-header">
              <span class="content-main-title">{{ currentModel.name }}</span>
            </view>
            <view class="vk-page-card" style="margin-top: 10px">
              <cms-content-form
                ref="singlePageForm"
                v-model="singlePageData"
                :model="currentModel"
                :form-type="singlePageFormType"
                @success="onSinglePageSuccess"
              ></cms-content-form>
            </view>
          </template>
        </template>
        <view v-else class="content-empty">
          <i class="el-icon-document-copy" style="font-size: 48px; display: block; margin-bottom: 16px; color: #c0c4cc"></i>
          <p>请从左侧选择一个内容模型</p>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
  let vk = uni.vk;
  export default {
    data() {
      return {
        modelList: [],
        filteredModels: [],
        searchKeyword: '',
        // 从内容编辑页返回后才需要刷新表格，避免页面首次显示时重复请求
        needRefreshTable: false,
        singlePageData: {},
        singlePageFormType: 'add',
        singlePageSaving: false,
      };
    },
    computed: {
      groupedModels() {
        const groups = [];
        const typeConfig = [
          { type: 'collection', label: '集合' },
          { type: 'single', label: '单页' },
        ];
        for (const config of typeConfig) {
          const items = this.filteredModels.filter((m) => m.type === config.type);
          groups.push({ type: config.type, label: config.label, items });
        }
        return groups;
      },
      currentModel() {
        return vk.getVuex('$app.model');
      },
      // 当前内容语言：与内容编辑页共享
      locale() {
        return vk.getVuex('$app.locale');
      },
    },
    onLoad(options = {}) {
      vk = this.vk;
      this.options = options;
      this.init();
    },
    // 从内容编辑页返回时刷新表格，展示编辑后的最新数据
    onShow() {
      if (!this.needRefreshTable) return;
      this.needRefreshTable = false;
      if (this.$refs.contentTable) this.$refs.contentTable.refresh();
    },
    methods: {
      init() {
        vk.callFunction({
          url: 'admin/cms/sys.model.getList',
          title: '请求中',
          success: (res) => {
            this.modelList = res.rows.filter((m) => m.type !== 'component');
            this.filterModels();
          },
        });
      },
      filterModels() {
        if (!this.searchKeyword) {
          this.filteredModels = [...this.modelList];
        } else {
          const keyword = this.searchKeyword.toLowerCase();
          this.filteredModels = this.modelList.filter((item) => item.name.toLowerCase().includes(keyword) || item.key.toLowerCase().includes(keyword));
        }
      },
      onModelClick(item) {
        if (item._id === this.currentModel._id) return;
        // this.currentModel = item;
        vk.setVuex('$app.model', item);
        if (item.type === 'single') {
          this.loadSinglePageData();
        }
      },
      loadSinglePageData() {
        this.singlePageFormType = 'add';
        // 构建包含 model_id 的默认数据
        const defaultData = { model_id: this.currentModel._id, status: this.currentModel.draft ? false : true };
        (this.currentModel.fields || []).forEach((f) => {
          if (f.default_value !== undefined && f.default_value !== null && f.default_value !== '') {
            defaultData[f.key] = f.default_value;
          }
        });
        let formData = { model_id: this.currentModel._id };
        if (this.currentModel.internationalization) {
          defaultData.locale = this.locale;
          formData.locale = this.locale;
        }
        this.singlePageData = defaultData;
        let columns = Object.keys(formData).map((key) => ({ key, mode: '=' }));
        vk.callFunction({
          url: 'admin/cms/sys.content.getList',
          title: '加载中',
          data: { pageIndex: 1, pageSize: 1, formData, columns },
          success: (res) => {
            if (res.rows && res.rows.length > 0) {
              this.singlePageData = res.rows[0];
              this.singlePageFormType = 'update';
            }
          },
        });
      },
      saveSinglePage() {
        this.singlePageSaving = true;
        if (this.$refs.singlePageForm) {
          this.$refs.singlePageForm.submit();
        }
      },
      onSinglePageSuccess() {
        this.singlePageSaving = false;
        this.$message.success('保存成功');
        this.loadSinglePageData();
      },
      onAdd({ locale } = {}) {
        // 新增的内容归属于当前选中的语言，通过参数传给编辑页注入表单默认数据
        let url = '/pages/cms/content/edit?mode=add&model_id=' + this.currentModel._id;
        if (vk.pubfn.isNotNull(locale)) url += '&locale=' + locale;
        this.toContentEditPage(url);
      },
      onUpdate({ item }) {
        // 编辑通过 document_id 定位内容，locale 决定打开哪个语言版本
        let url = '/pages/cms/content/edit?mode=update&model_id=' + this.currentModel._id + '&document_id=' + item.document_id + '&locale=' + this.locale;
        this.toContentEditPage(url);
      },
      toContentEditPage(url) {
        this.needRefreshTable = true;
        vk.navigateTo(url);
      },
    },
  };
</script>

<style lang="scss" scoped>
  .content-layout {
    display: flex;
    gap: 10px;
    height: calc(100vh - 70px);
    background: #f6f6f9;
    border-radius: 4px;
    overflow: hidden;
  }

  .content-sidebar {
    width: 260px;
    border-right: 1px solid #ebeef5;
    display: flex;
    flex-direction: column;
    background: #fff;
  }

  .sidebar-search {
    padding: 12px;
  }

  .model-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .model-group {
    margin-bottom: 4px;
  }

  .group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 600;
    color: #666687;
    background: #fff;
  }

  .group-add {
    cursor: pointer;
    color: #666687;
    background: #eaeaef;
    font-size: 10px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .group-items {
    padding: 4px;
  }

  .model-item {
    display: flex;
    align-items: center;
    padding: 8px 12px 8px 28px;
    cursor: pointer;
    transition: background 0.2s;
    font-size: 14px;
    color: #32324d;
    text-decoration: none;
    border-radius: 4px;

    &:hover {
      background: #f5f7fa;
    }

    &.active {
      background: #ecf5ff;
      color: #409eff;
      font-weight: bold;
    }
  }

  .model-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-decoration: none;
  }

  .empty-tip {
    padding: 40px 20px;
    text-align: center;
    color: #909399;
    font-size: 14px;
  }

  .content-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #f6f6f9;
  }

  .content-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #909399;

    i {
      font-size: 48px;
      margin-bottom: 16px;
    }

    p {
      font-size: 14px;
    }
  }

  .content-main-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 10px;
  }

  .content-main-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }
</style>
