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
          <!-- 公共头部 -->
          <view class="content-main-header">
            <span class="content-main-title">{{ currentModel.type === 'collection' ? currentModel.name + '列表' : currentModel.name }}</span>
            <el-button v-if="currentModel.type === 'collection'" type="primary" size="small" icon="el-icon-plus" @click="onAdd">添加{{ currentModel.name }}</el-button>
          </view>
          <!-- 集合类：内容表格组件 -->
          <cms-content-table v-if="currentModel.type === 'collection'" ref="contentTable" :model="currentModel" @update="onUpdate"></cms-content-table>
          <!-- 单页类：直接显示表单 -->
          <view v-else-if="currentModel.type === 'single'" class="vk-page-card" style="margin-top: 10px">
            <cms-content-form ref="singlePageForm" v-model="singlePageData" :model="currentModel" :form-type="singlePageFormType" @success="onSinglePageSuccess"></cms-content-form>
          </view>
        </template>
        <view v-else class="content-empty">
          <i class="el-icon-document-copy" style="font-size: 48px; display: block; margin-bottom: 16px; color: #c0c4cc"></i>
          <p>请从左侧选择一个内容模型</p>
        </view>
      </view>
    </view>
    <!-- 内容表单弹窗（表单组件仅封装 vk-data-form，弹窗由页面承载） -->
    <!-- destroy-on-close 必须为 true：弹窗关闭时销毁内容，否则 tinymce 等第三方编辑器实例不会重新初始化，导致再次打开时无法显示内容/无法输入 -->
    <template v-if="vk.pubfn.isNotNull(currentModel)">
      <vk-data-dialog v-model="formDatas.contentForm.show" :title="formDatas.contentForm.title" width="1000px" mode="form" :close-on-click-modal="false" :destroy-on-close="true">
        <cms-content-form v-model="formDatas.contentForm.data" :model="currentModel" :form-type="formDatas.contentForm.formType" @success="onFormSuccess"></cms-content-form>
      </vk-data-dialog>
    </template>
  </view>
</template>

<script>
  let vk = uni.vk;
  export default {
    data() {
      return {
        modelList: [],
        filteredModels: [],
        currentModel: {},
        searchKeyword: '',
        formDatas: {
          contentForm: { show: false, title: '', formType: 'add', data: {} },
        },
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
    },
    onLoad(options = {}) {
      vk = this.vk;
      this.options = options;
      this.init();
    },
    methods: {
      init() {
        vk.callFunction({
          url: 'admin/cms/model/sys/getList',
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
        this.currentModel = item;
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
        this.singlePageData = defaultData;
        vk.callFunction({
          url: 'admin/cms/content/sys/getList',
          title: '加载中',
          data: { model_id: this.currentModel._id, page: 1, limit: 1 },
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
      onAdd() {
        vk.pubfn.openForm('contentForm', { show: true, title: '添加' + this.currentModel.name, formType: 'add', data: {} }, this);
      },
      onUpdate({ item }) {
        vk.pubfn.openForm('contentForm', { show: true, title: '编辑' + this.currentModel.name, formType: 'update', data: item }, this);
      },
      onFormSuccess() {
        vk.pubfn.closeForm('contentForm', this);
        this.$refs.contentTable.refresh();
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
