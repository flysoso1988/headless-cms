<template>
  <div class="vk-data-input-file-select" :style="rootStyle">
    <div v-if="controls" class="selector-panel vk-contents" :class="disabled ? 'is-disabled' : ''">
      <template v-if="multiple">
        <draggable
          class="image-list"
          tag="div"
          :value="currentValueList"
          :disabled="disabled"
          :animation="300"
          ghost-class="ghost"
          draggable=".image-item"
          filter=".add-btn"
          @input="onDraggableInput"
        >
          <div v-for="(item, index) in displayValueList" :key="item.key" class="image-item" :style="!disabled ? 'cursor: move' : ''">
            <el-image v-if="isImageType" :key="getFileRenderKey(item.rawValue)" :src="item.url" :fit="imageFit" class="image" @error="refreshFileUrl(item.rawValue)"></el-image>
            <el-image
              v-else-if="isVideoType"
              :key="getFileRenderKey(item.rawValue)"
              :src="getVideoCover(item.url)"
              :fit="imageFit"
              class="image"
              @error="refreshFileUrl(item.rawValue)"
            ></el-image>
            <div v-else-if="isAudioType" class="other-icon selector-audio-icon">
              <vk-data-icon name="el-icon-headset" :size="26" color="#916cff"></vk-data-icon>
            </div>
            <div v-else class="other-icon">
              <vk-data-icon name="el-icon-document" :size="34" color="#d5d5de"></vk-data-icon>
            </div>

            <div class="image-mask" v-if="!disabled">
              <vk-data-icon name="el-icon-zoom-in" :size="20" color="#ffffff" class="mask-item mask-item-1" @click="previewValue(item)"></vk-data-icon>
              <vk-data-icon name="el-icon-delete" :size="20" color="#ffffff" class="mask-item mask-item-2" @click="deleteItem(index)"></vk-data-icon>
            </div>
            <div class="image-mask" v-else>
              <vk-data-icon name="el-icon-zoom-in" :size="20" color="#ffffff" class="mask-item mask-item-11" @click="previewValue(item)"></vk-data-icon>
            </div>
          </div>

          <div v-if="!disabled && !isMaxCom" slot="footer" class="selector-add-card add-btn" @click.stop="open">
            <vk-data-icon name="el-icon-plus" :size="28" color="#8c939d"></vk-data-icon>
          </div>
        </draggable>
      </template>

      <template v-else>
        <div class="image-list">
          <div v-if="displayValueList.length" class="image-item">
            <el-image
              v-if="isImageType"
              :key="getFileRenderKey(displayValueList[0].rawValue)"
              :src="displayValueList[0].url"
              :fit="imageFit"
              class="image"
              @error="refreshFileUrl(displayValueList[0].rawValue)"
            ></el-image>
            <el-image
              v-else-if="isVideoType"
              :key="getFileRenderKey(displayValueList[0].rawValue)"
              :src="getVideoCover(displayValueList[0].url)"
              :fit="imageFit"
              class="image"
              @error="refreshFileUrl(displayValueList[0].rawValue)"
            ></el-image>
            <div v-else-if="isAudioType" class="other-icon selector-audio-icon">
              <vk-data-icon name="el-icon-headset" :size="26" color="#916cff"></vk-data-icon>
            </div>
            <div v-else class="other-icon">
              <vk-data-icon name="el-icon-document" :size="34" color="#d5d5de"></vk-data-icon>
            </div>

            <div class="image-mask" v-if="!disabled">
              <vk-data-icon name="el-icon-zoom-in" :size="20" color="#ffffff" class="mask-item mask-item-1" @click="previewValue(displayValueList[0])"></vk-data-icon>
              <vk-data-icon name="el-icon-delete" :size="20" color="#ffffff" class="mask-item mask-item-2" @click="clearItem"></vk-data-icon>
            </div>
            <div class="image-mask" v-else>
              <vk-data-icon name="el-icon-zoom-in" :size="20" color="#ffffff" class="mask-item mask-item-11" @click="previewValue(displayValueList[0])"></vk-data-icon>
            </div>
          </div>

          <div v-if="!displayValueList.length && !disabled" class="selector-add-card add-btn" @click.stop="open">
            <vk-data-icon name="el-icon-plus" :size="28" color="#8c939d"></vk-data-icon>
          </div>
          <div v-else-if="!displayValueList.length" class="selector-add-card add-btn is-disabled">
            <vk-data-icon name="el-icon-plus" :size="28" color="#c0c4cc"></vk-data-icon>
          </div>
        </div>
      </template>
    </div>

    <vk-data-dialog
      :title="$t('vk.assetLibrary.selectTitle')"
      v-model="dialogVisible"
      width="clamp(1280px, 70vw, 1600px)"
      top="2vh"
      mode="form"
      :append-to-body="true"
      :close-on-click-modal="true"
      :destroy-on-close="true"
      custom-class="file-select-dialog"
    >
      <div class="selector-dialog-body">
        <asset-library
          ref="assetLibrary"
          mode="selector"
          :file-type="fileType"
          :multiple="multiple"
          :multiple-limit="multipleLimit"
          :current-value-count="currentValueCount"
          :default-category="defaultCategoryCom"
          :upload="upload"
          :update-category="updateCategory"
          :return-type="returnType"
          :cloud-directory="cloudDirectory"
          :cloud-path-remove-chinese="cloudPathRemoveChinese"
          :provider="provider"
          :uni-cloud="uniCloud"
          :env="env"
          :file-size="fileSize"
          :size-unit="sizeUnit"
          :encrypt-action="encryptAction"
          @select-single="handleSingleSelect"
          @select-multiple="handleMultipleSelect"
        ></asset-library>
      </div>
    </vk-data-dialog>

    <vk-data-dialog v-model="preview.visible" :title="$t('vk.assetLibrary.previewFile')" width="820px" top="6vh" :append-to-body="true">
      <div v-if="preview.visible" v-loading="previewLoading" class="preview-body">
        <image
          v-if="preview.type === 'image'"
          :key="getFileRenderKey(preview.rawValue, 'preview')"
          :src="previewUrl"
          mode="widthFix"
          class="preview-image"
          @error="refreshFileUrl(preview.rawValue, 'preview')"
        ></image>
        <video
          v-else-if="preview.type === 'video'"
          :key="getFileRenderKey(preview.rawValue, 'preview')"
          :src="previewUrl"
          controls
          autoplay
          class="preview-video"
          @error="refreshFileUrl(preview.rawValue, 'preview')"
        ></video>
        <div v-else class="preview-fallback">
          <div class="preview-name">{{ preview.name }}</div>
          <el-button type="primary" :disabled="previewLoading" @click="openExternal(previewUrl)">{{ $t('vk.form.fileSelect.openFile') }}</el-button>
        </div>
      </div>
    </vk-data-dialog>
  </div>
</template>

<script>
  import draggable from 'vuedraggable';
  import assetLibrary from '@/pages_plugs/system_uni/uni-id-files/components/asset-library';

  export default {
    name: 'vk-data-input-file-select',
    components: {
      draggable,
      assetLibrary,
    },
    props: {
      value: {
        type: [String, Array],
      },
      placeholder: {
        type: String,
        default: '',
      },
      width: {
        type: [String, Number],
        default: '',
      },
      returnType: {
        type: String,
        default: 'url',
      },
      fileType: {
        type: String,
        default: 'image',
      },
      disabled: {
        type: Boolean,
        default: false,
      },
      multiple: {
        type: Boolean,
        default: false,
      },
      multipleLimit: {
        type: Number,
        default: 9,
      },
      defaultCategory: {
        type: String,
        default: '',
      },
      category_id: {
        type: String,
        default: '',
      },
      upload: {
        type: Boolean,
        default: true,
      },
      updateCategory: {
        type: Boolean,
        default: true,
      },
      controls: {
        type: Boolean,
        default: true,
      },
      imageFit: {
        type: String,
        default: 'cover',
      },
      cloudDirectory: {
        type: String,
        default: '',
      },
      cloudPathRemoveChinese: {
        type: Boolean,
        default: true,
      },
      provider: {
        type: String,
        default: '',
      },
      uniCloud: {
        type: Object,
      },
      env: {
        type: String,
        default: '',
      },
      fileSize: {
        type: Number,
      },
      sizeUnit: {
        type: String,
        default: 'MB',
      },
      encryptAction: {
        type: Boolean,
        default: false,
      },
    },
    data() {
      return {
        dialogVisible: false,
        formDatas: {},
        fileMap: {},
        fileUrlRequestMap: {},
        fileUrlRetryMap: {},
        fileLoadErrorMap: {},
        fileReloadMap: {},
        itemUidCounter: 0,
        itemUidList: [],
        preview: {
          visible: false,
          rawValue: '',
          name: '',
          type: '',
        },
      };
    },
    computed: {
      currentValueList() {
        if (this.multiple) {
          return Array.isArray(this.value) ? this.value : [];
        }
        return this.value ? [this.value] : [];
      },
      rootStyle() {
        if (!this.width) {
          return {};
        }
        let width = this.width;
        if (typeof width === 'number') {
          width = `${width}px`;
        }
        return { width };
      },
      currentValueCount() {
        return this.currentValueList.length;
      },
      displayValueList() {
        return this.currentValueList.map((item, index) => {
          let url = this.getFileUrl(item);
          return {
            key: this.itemUidList[index] || `${item}-${index}`,
            uid: this.itemUidList[index] || `${item}-${index}`,
            rawValue: item,
            url,
            name: this.getDisplayName(url, item),
          };
        });
      },
      isImageType() {
        return this.fileType === 'image';
      },
      isVideoType() {
        return this.fileType === 'video';
      },
      isAudioType() {
        return this.fileType === 'audio';
      },
      isMaxCom() {
        return this.multiple && this.currentValueCount >= this.multipleLimit;
      },
      previewUrl() {
        return this.getFileUrl(this.preview.rawValue);
      },
      previewLoading() {
        return this.fileUrlRequestMap[this.preview.rawValue] === true;
      },
      addButtonText() {
        return this.currentValueCount ? this.$t('vk.form.fileSelect.continueAdd') : this.$t('vk.assetLibrary.uploadAssets');
      },
      placeholderText() {
        return this.placeholder || this.$t('vk.assetLibrary.pleaseSelect');
      },
      fileTypeText() {
        if (this.fileType === 'image') {
          return this.$t('vk.assetLibrary.image');
        }
        if (this.fileType === 'video') {
          return this.$t('vk.assetLibrary.video');
        }
        if (this.fileType === 'audio') {
          return this.$t('vk.assetLibrary.audio');
        }
        return this.$t('vk.form.fileSelect.defaultFileName');
      },
      defaultCategoryCom() {
        return this.defaultCategory || this.category_id || '';
      },
    },
    watch: {
      disabled(value) {
        if (value) this.dialogVisible = false;
      },
      value: {
        immediate: true,
        handler(newVal, oldVal) {
          this.syncTempUrls(oldVal);
          this.syncItemUidList(newVal);
        },
      },
      returnType() {
        this.syncTempUrls();
      },
    },
    methods: {
      open() {
        if (this.disabled) {
          return;
        }
        this.dialogVisible = true;
      },
      syncTempUrls(oldValue) {
        if (this.returnType !== 'id') {
          return;
        }
        const vk = uni.vk;
        let oldList = Array.isArray(oldValue) ? oldValue : [oldValue];
        let ids = this.currentValueList.filter((item) => vk.pubfn.isNotNull(item) && (oldList.indexOf(item) === -1 || vk.pubfn.isNull(this.fileMap[item])));
        if (!ids.length) {
          return;
        }
        ids.forEach((id) => {
          this.fileUrlRetryMap[id] = false;
        });
        this.getTempFileURL(ids);
      },
      syncItemUidList(newVal) {
        if (!newVal || !Array.isArray(newVal)) {
          this.itemUidList = [];
          return;
        }
        while (this.itemUidList.length < newVal.length) {
          this.itemUidList.push(++this.itemUidCounter);
        }
        if (this.itemUidList.length > newVal.length) {
          this.itemUidList.length = newVal.length;
        }
      },
      getTempFileURL(ids) {
        let vk = uni.vk;
        ids = [...new Set(ids)].filter((id) => vk.pubfn.isNotNull(id) && !this.fileUrlRequestMap[id]);
        if (!ids.length) {
          return;
        }
        ids.forEach((id) => {
          this.$set(this.fileUrlRequestMap, id, true);
        });
        vk.callFunction({
          url: 'admin/system_uni/uni-id-files/files/sys/getTempFileURL',
          needAlert: false,
          data: {
            ids,
          },
          encrypt: this.encryptAction,
          success: (data) => {
            let fileList = data.fileList || [];
            let fileMap = fileList.reduce((acc, item, index) => {
              if (vk.pubfn.isNull(item.tempFileURL)) {
                return acc;
              }
              acc[item.fileID] = item.tempFileURL;
              acc[ids[index]] = item.tempFileURL;
              return acc;
            }, {});
            this.fileMap = Object.assign({}, this.fileMap, fileMap);
            ids.forEach((id) => {
              if (vk.pubfn.isNull(fileMap[id])) {
                return;
              }
              ['thumbnail', 'preview'].forEach((target) => {
                let key = `${target}:${id}`;
                if (this.fileLoadErrorMap[key]) {
                  this.fileLoadErrorMap[key] = false;
                  // URL 未变时也要重建失败节点，确保真正重试媒体加载。
                  this.$set(this.fileReloadMap, key, (this.fileReloadMap[key] || 0) + 1);
                }
              });
            });
          },
          complete: () => {
            ids.forEach((id) => {
              this.$set(this.fileUrlRequestMap, id, false);
            });
          },
        });
      },
      refreshFileUrl(value, target = 'thumbnail') {
        const vk = uni.vk;
        if (this.returnType !== 'id' || vk.pubfn.isNull(value)) {
          return;
        }
        if (this.fileUrlRetryMap[value] && !this.fileUrlRequestMap[value]) {
          return;
        }
        // 同一轮选择或预览最多补偿一次，避免无效文件反复触发请求。
        this.fileUrlRetryMap[value] = true;
        this.fileLoadErrorMap[`${target}:${value}`] = true;
        // 在途请求返回后统一重载已失败的节点，无需重复请求链接。
        if (this.fileUrlRequestMap[value]) {
          return;
        }
        this.getTempFileURL([value]);
      },
      getFileRenderKey(value, target = 'thumbnail') {
        let key = `${target}:${value}`;
        return `${key}:${this.fileReloadMap[key] || 0}`;
      },
      getFileUrl(value) {
        const vk = uni.vk;
        if (vk.pubfn.isNull(value)) {
          return '';
        }
        if (this.returnType === 'id') {
          return this.fileMap[value] || (/^https?:\/\//i.test(value) ? value : '');
        }
        return this.fileMap[value] || value;
      },
      getDisplayName(url, rawValue) {
        let text = url || rawValue || '';
        if (!text) {
          return this.$t('vk.form.fileSelect.defaultFileName');
        }
        let cleanText = text.split('?')[0];
        let arr = cleanText.split('/');
        return arr[arr.length - 1] || rawValue || this.$t('vk.form.fileSelect.defaultFileName');
      },
      handleSingleSelect(item) {
        if (this.disabled) return;
        let returnValue = this.getReturnValue(item);
        this._updateValue(returnValue, item);
        this.$emit('selected', returnValue, item);
        this.dialogVisible = false;
      },
      handleMultipleSelect(items) {
        if (this.disabled) return;
        let currentList = this.currentValueList.slice();
        let selectedList = [];
        let selectedInfoList = [];
        items.forEach((item) => {
          let returnValue = this.getReturnValue(item);
          if (currentList.length < this.multipleLimit) {
            currentList.push(returnValue);
            selectedList.push(returnValue);
            selectedInfoList.push(item);
          }
        });
        this._updateValue(currentList, selectedInfoList);
        this.$emit('selected', selectedList, selectedInfoList);
        this.dialogVisible = false;
      },
      getReturnValue(item) {
        if (this.returnType === 'id') {
          return item.file_id;
        }
        return item.url;
      },
      _updateValue(value, option) {
        let newValue = value;
        if (this.multiple && !Array.isArray(newValue)) {
          newValue = newValue ? [newValue] : [];
        }
        if (!this.multiple && Array.isArray(newValue)) {
          newValue = newValue[0] || '';
        }
        this.$emit('input', newValue);
        this.$emit('change', newValue, option);
      },
      deleteItem(index) {
        if (this.disabled) {
          return;
        }
        let list = this.currentValueList.slice();
        list.splice(index, 1);
        this._updateValue(list, list);
      },
      clearItem() {
        if (this.disabled) {
          return;
        }
        if (this.multiple) {
          this._updateValue([], []);
        } else {
          this._updateValue('', {});
        }
      },
      previewValue(item) {
        this.preview.visible = true;
        this.preview.rawValue = item.rawValue;
        this.preview.name = item.name;
        this.preview.type = this.fileType;
        if (this.returnType === 'id') {
          this.fileUrlRetryMap[item.rawValue] = false;
          this.getTempFileURL([item.rawValue]);
        }
      },
      openExternal(url) {
        const vk = uni.vk;
        if (vk.pubfn.isNull(url)) {
          return;
        }
        window.open(url, '_blank');
      },
      getVideoCover(url) {
        if (!url) {
          return '';
        }
        let width = 600;
        let height = 600;
        let aliyun = `x-oss-process=video/snapshot,t_1000,f_jpg,w_${width},h_${height},m_fast`;
        let qiniu = `vframe/jpg/offset/1/w/${width}/h/${height}`;
        let src = url;
        src += src.indexOf('?') === -1 ? '?' : '&';
        src += `${aliyun}&${qiniu}`;
        return src;
      },
      onDraggableInput(newList) {
        if (this.disabled) return;
        let oldValue = this.currentValueList || [];
        let newUidList = [];
        let usedIndices = [];
        for (let i = 0; i < newList.length; i++) {
          let matched = false;
          for (let j = 0; j < oldValue.length; j++) {
            if (usedIndices.indexOf(j) === -1 && oldValue[j] === newList[i]) {
              newUidList.push(this.itemUidList[j]);
              usedIndices.push(j);
              matched = true;
              break;
            }
          }
          if (!matched) {
            newUidList.push(++this.itemUidCounter);
          }
        }
        this.itemUidList = newUidList;
        this._updateValue([].concat(newList), [].concat(newList));
      },
    },
  };
</script>

<style lang="scss" scoped>
  ::v-deep {
    .vk-data-dialog.dialog-form {
      display: flex;
      flex-direction: column;
      max-height: 96vh;
      .el-dialog__header {
        flex-shrink: 0;
      }
      .el-dialog__body {
        padding: 10px;
        background-color: #f5f5f5;
        flex: 1;
        min-height: 0;
        display: flex;
      }
    }
  }
  .vk-data-input-file-select {
    width: 100%;
  }

  .selector-panel {
    width: 100%;
  }

  .selector-panel.is-disabled {
    opacity: 0.72;
  }

  .ghost {
    opacity: 0.4;
    border: 1px dashed #409eff;
  }

  .image-list {
    display: inline-flex;
    flex-wrap: wrap;
  }

  .image-item,
  .selector-add-card {
    width: 80px;
    height: 80px;
    line-height: 80px;
    display: inline-block;
    margin: 0 8px 8px 0;
    box-sizing: border-box;
    border-radius: 6px;
    overflow: hidden;
    position: relative;
    user-select: none;
    vertical-align: top;
  }

  .image-item {
    background-color: #ffffff;
    border: 1px solid #c0ccda;
  }

  .image {
    width: 100%;
    height: 100%;
    display: block;
  }

  .other-icon {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #ffffff;
  }

  .selector-audio-icon {
    background: linear-gradient(180deg, #f8f5ff 0%, #ede6ff 100%);
  }

  .image-mask {
    position: absolute;
    width: 100%;
    height: 100%;
    display: block;
    top: 0;
    left: 0;
    transition: background-color 0.3s;
  }

  .mask-item {
    display: none;
    cursor: pointer;
  }

  .mask-item-1 {
    position: absolute;
    left: 10px;
    top: 30px;
  }

  .mask-item-11 {
    position: absolute;
    left: 29px;
    top: 30px;
  }

  .mask-item-2 {
    position: absolute;
    right: 10px;
    top: 30px;
  }

  .image-mask:hover {
    display: block;
    background-color: rgba(0, 0, 0, 0.5);
  }

  .image-mask:hover .mask-item {
    display: block;
  }

  .selector-add-card {
    // 拖动到末尾时 Sortable 可能将图片插到 footer 后，保持添加按钮始终显示在最后。
    order: 1;
    text-align: center;
    background-color: #fbfdff;
    border: 1px dashed #c0ccda;
    cursor: pointer;
    display: inline-flex;
    justify-content: center;
    align-items: center;
  }

  .selector-add-card:hover {
    border: 1px dashed #66b1ff;
  }

  .selector-add-card.is-disabled {
    cursor: not-allowed;
    border-color: #dcdfe6;
    background-color: #f5f7fa;
  }

  .selector-add-text {
    display: none;
  }

  .selector-dialog-body {
    flex: 1;
    min-height: 0;
  }

  .preview-body {
    min-height: 280px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-image,
  .preview-video {
    width: 100%;
    max-height: 72vh;
  }

  .preview-fallback {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .preview-name {
    font-size: 14px;
    color: #25304a;
    word-break: break-all;
    text-align: center;
  }

  .text-one {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
</style>
