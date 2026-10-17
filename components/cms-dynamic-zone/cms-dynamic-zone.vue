<template>
  <view class="cms-dynamic-zone">
    <!-- 列表 / 详情场景：区块摘要 -->
    <span v-if="isSummaryScene" class="dz-summary">{{ summaryText }}</span>

    <!-- 表单场景：区块编辑器 -->
    <template v-else>
      <view class="dz-list">
        <view v-if="localBlocks.length === 0" class="dz-empty">暂无区块，点击下方「添加块」开始拼装</view>
        <draggable v-else v-model="localBlocks" handle=".dz-handle" :disabled="disabled" @end="emitChange">
          <view v-for="(block, index) in localBlocks" :key="block.__uid" class="dz-block">
            <view class="dz-handle">
              <vk-data-icon name="el-icon-rank" :size="14" color="#c0c4cc"></vk-data-icon>
            </view>
            <view class="dz-block-main">
              <span class="dz-block-name">{{ getBlockName(block) }}</span>
              <span v-if="modelsLoaded && !isKnownComponent(block)" class="dz-unknown">未知组件「{{ block.__component }}」，前台可能无法按类型渲染，请确认后再处理</span>
            </view>
            <view class="dz-block-actions">
              <el-button v-if="isKnownComponent(block)" type="text" size="mini" :disabled="disabled" @click="editBlock(block, index)">编辑</el-button>
              <el-button type="text" size="mini" class="dz-delete" :disabled="disabled" @click="removeBlock(index)">删除</el-button>
            </view>
          </view>
        </draggable>
      </view>
      <view class="dz-add">
        <el-dropdown v-if="allowedModels.length > 0" trigger="click" :disabled="disabled" @command="addBlock">
          <el-button size="small" type="primary" plain icon="el-icon-plus">添加块</el-button>
          <el-dropdown-menu slot="dropdown">
            <el-dropdown-item v-for="item in allowedModels" :key="item.key" :command="item.key">{{ item.name }}</el-dropdown-item>
          </el-dropdown-menu>
        </el-dropdown>
        <span v-else class="dz-empty-tip">当前无可用组件，请先在设计器中为「{{ columnTitle }}」勾选允许的组件</span>
      </view>
      <!-- 块录入弹窗：按仓库规则一律经 vk.pubfn.openForm 打开 -->
      <cms-dynamic-zone-block-form v-model="formDatas.blockForm" @success="onBlockFormSuccess"></cms-dynamic-zone-block-form>
    </template>
  </view>
</template>

<script>
  let vk = uni.vk;
  import draggable from 'vuedraggable';

  // 组件类型模型缓存：同一页面生命周期内多个动态区块字段共用一份请求结果
  let componentModelsCache = null;

  function loadComponentModels() {
    if (componentModelsCache) return Promise.resolve(componentModelsCache);
    return new Promise((resolve) => {
      vk.callFunction({
        url: 'admin/cms/sys.model.getList',
        data: { type: 'component' },
        success: (res) => {
          componentModelsCache = res.rows || [];
          resolve(componentModelsCache);
        },
        fail: () => {
          resolve([]);
        },
      });
    });
  }

  export default {
    name: 'cms-dynamic-zone',
    components: {
      draggable,
    },
    props: {
      // 字段值：组件实例的有序数组，每块形如 { __component, ...该组件模型的字段 }
      value: { type: Array, default: () => [] },
      // 字段（表单/表格）列配置，动态区块的允许组件集合挂在 column.components 上
      column: { type: Object, default: () => ({}) },
      // 渲染场景：form 表单 / table 表格 / detail 详情
      scene: { type: String, default: 'form' },
      disabled: { type: Boolean, default: false },
    },
    data() {
      return {
        // 内部的块数组（附加 __uid 供拖拽 key 使用，提交前剥离）
        localBlocks: [],
        uidSeed: 0,
        // 本次变更由组件自身发起：抑制 value 回流时的重建，避免拖拽后重挂载
        emitLock: false,
        componentModels: [],
        modelsLoaded: false,
        formDatas: {
          blockForm: { show: false, mode: 'add', item: {}, options: {} },
        },
      };
    },
    computed: {
      isSummaryScene() {
        return this.scene === 'table' || this.scene === 'detail';
      },
      summaryText() {
        let list = Array.isArray(this.value) ? this.value : [];
        return list.length + ' 个区块';
      },
      columnTitle() {
        return (this.column && this.column.title) || '动态区块';
      },
      allowedKeys() {
        return (this.column && this.column.components) || [];
      },
      allowedModels() {
        return this.componentModels.filter((model) => this.allowedKeys.indexOf(model.key) > -1);
      },
    },
    watch: {
      value: {
        handler(val) {
          this.syncFromValue(val);
        },
        immediate: true,
      },
    },
    mounted() {
      if (this.isSummaryScene) return;
      loadComponentModels().then((models) => {
        this.componentModels = models;
        this.modelsLoaded = true;
      });
    },
    methods: {
      // 外部值 → 内部块数组（生成稳定的拖拽 key）
      syncFromValue(val) {
        if (this.emitLock) return;
        this.localBlocks = (Array.isArray(val) ? val : []).map((block) => Object.assign({ __uid: this.nextUid() }, block));
      },
      nextUid() {
        this.uidSeed += 1;
        return 'dz_' + this.uidSeed;
      },
      // 内部块数组 → 外部值（剥离 __uid）
      emitChange() {
        this.emitLock = true;
        this.$emit(
          'input',
          this.localBlocks.map((block) => {
            let copy = Object.assign({}, block);
            delete copy.__uid;
            return copy;
          })
        );
        this.$nextTick(() => {
          this.emitLock = false;
        });
      },
      getModelByKey(componentKey) {
        return this.componentModels.find((model) => model.key === componentKey);
      },
      isKnownComponent(block) {
        return !!this.getModelByKey(block.__component);
      },
      getBlockName(block) {
        let model = this.getModelByKey(block.__component);
        return model ? model.name : block.__component;
      },
      addBlock(componentKey) {
        let model = this.getModelByKey(componentKey);
        if (!model) return;
        let item = { __component: componentKey };
        (model.fields || []).forEach((f) => {
          if (f.default_value !== undefined && f.default_value !== null && f.default_value !== '') {
            item[f.key] = f.default_value;
          }
        });
        vk.pubfn.openForm(
          'blockForm',
          {
            mode: 'add',
            item,
            options: { model, index: this.localBlocks.length + 1 },
          },
          this
        );
      },
      editBlock(block, index) {
        let model = this.getModelByKey(block.__component);
        if (!model) return;
        vk.pubfn.openForm(
          'blockForm',
          {
            mode: 'update',
            item: Object.assign({}, block),
            options: { model, index: index + 1 },
          },
          this
        );
      },
      removeBlock(index) {
        this.localBlocks.splice(index, 1);
        this.emitChange();
      },
      // 块表单提交成功：按新增/编辑落位后回写字段值
      onBlockFormSuccess(blockData) {
        let form = this.formDatas.blockForm || {};
        let item = form.item || {};
        if (form.mode === 'update') {
          let index = this.localBlocks.findIndex((block) => block.__uid === item.__uid);
          if (index > -1) {
            let uid = this.localBlocks[index].__uid;
            this.$set(this.localBlocks, index, Object.assign({ __uid: uid }, blockData));
          }
        } else {
          this.localBlocks.push(Object.assign({ __uid: this.nextUid() }, blockData));
        }
        form.show = false;
        this.emitChange();
      },
    },
  };
</script>

<style lang="scss" scoped>
  .cms-dynamic-zone {
    width: 100%;
  }

  .dz-summary {
    color: #606266;
  }

  .dz-list {
    margin-bottom: 10px;
  }

  .dz-empty {
    padding: 16px;
    text-align: center;
    color: #909399;
    font-size: 13px;
    background: #fafafa;
    border: 1px dashed #dcdfe6;
    border-radius: 4px;
  }

  .dz-block {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: #fff;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .dz-handle {
    cursor: move;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c0c4cc;

    &:hover {
      background-color: #f6f6f9;
    }
  }

  .dz-block-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .dz-block-name {
    font-size: 14px;
    color: #303133;
  }

  .dz-unknown {
    font-size: 12px;
    color: #e6a23c;
  }

  .dz-block-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .dz-delete {
    color: #f56c6c;
  }

  .dz-empty-tip {
    font-size: 13px;
    color: #909399;
  }
</style>
