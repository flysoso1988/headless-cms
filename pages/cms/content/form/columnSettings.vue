<template>
  <vk-data-dialog
    v-model="value.show"
    title="列表字段设置"
    width="500px"
    :close-on-click-modal="true"
    :destroy-on-close="true"
    mode="form"
  >
    <view style="padding: 20px; text-align: center; color: #909399;">
      设置内容待开发
    </view>
  </vk-data-dialog>
</template>

<script>
  export default {
    props: {
      value: {
        type: Object,
        default: () => ({})
      }
    }
  };
</script>
