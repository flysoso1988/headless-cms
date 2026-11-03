<template>
  <div class="vk-loading" :class="['vk-loading-' + size]" style="gap: 8px">
    <!-- 圆点旋转动画 (默认) -->
    <div class="vk-loading-dot vk-loading-dot-wait" v-if="animationType === 'dots'">
      <span class="vk-loading-dot-item" :style="{ 'background-color': color }"></span>
      <span class="vk-loading-dot-item" :style="{ 'background-color': color }"></span>
      <span class="vk-loading-dot-item" :style="{ 'background-color': color }"></span>
      <span class="vk-loading-dot-item" :style="{ 'background-color': color }"></span>
    </div>

    <!-- 圆环加载动画 -->
    <div class="circle-animation" v-if="animationType === 'circle'" :style="animationStyle">
      <div class="circle-loader"></div>
    </div>

    <!-- 波浪加载动画 -->
    <div class="wave-animation" v-if="animationType === 'wave'" :style="animationStyle">
      <div class="wave-loader">
        <div class="wave-dot" v-for="i in 5" :key="i" :style="{ animationDelay: (i - 1) * 0.1 + 's' }"></div>
      </div>
    </div>

    <!-- 图片加载动画 -->
    <image class="image" :src="image" v-if="animationType === 'image'" :style="imageStyle"></image>
  </div>
</template>

<script>
  import defaultLoadingImage from '@/static/icon/loading.gif';

  export default {
    props: {
      // 大小
      size: {
        type: String,
        default: 'default',
      },
      // 内置图标文字颜色
      color: {
        type: String,
        default: '#269939',
      },
      // 动画类型
      animationType: {
        type: String,
        default: 'dots',
        validator: function (value) {
          return ['dots', 'circle', 'wave', 'image'].indexOf(value) !== -1;
        },
      },
      // 图片地址 (当 animationType 为 image 时使用)
      image: {
        type: String,
        default: defaultLoadingImage,
      },
      // 图片样式
      imageStyle: {
        type: [String, Object],
      },
    },
    computed: {
      animationStyle() {
        return {
          '--animation-color': this.color,
          '--animation-color-alpha': this.color + '20',
        };
      },
    },
  };
</script>

<style lang="scss" scoped>
  .vk-loading {
    position: static;
    display: inline-block;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-size: 14px;
    font-variuni: tabular-nums;
    transition: transform 0.3s cubic-bezier(0.78, 0.14, 0.15, 0.86);
  }

  .vk-loading-dot {
    position: relative;
    /* display: inline-block; */
    font-size: 20px;
    width: 1em;
    height: 1em;
  }

  .vk-loading-dot-item {
    position: absolute;
    display: block;
    width: 9px;
    height: 9px;
    background-color: red;
    border-radius: 100%;
    transform: scale(0.75);
    transform-origin: 50% 50%;
    opacity: 0.3;
    animation: uniWaitMove 1s infinite linear alternate;
  }

  .vk-loading-dot-item:nth-child(1) {
    top: 0;
    left: 0;
  }

  .vk-loading-dot-item:nth-child(2) {
    top: 0;
    right: 0;
    animation-delay: 0.4s;
  }

  .vk-loading-dot-item:nth-child(3) {
    right: 0;
    bottom: 0;
    animation-delay: 0.8s;
  }

  .vk-loading-dot-item:nth-child(4) {
    bottom: 0;
    left: 0;
    animation-delay: 1.2s;
  }

  .vk-loading-dot-wait {
    transform: rotate(45deg);
    animation: uniRotate 1.2s infinite linear;
  }

  .vk-loading-mini .vk-loading-dot {
    font-size: 14px;
  }

  .vk-loading-mini .vk-loading-dot .vk-loading-dot-item {
    width: 6px;
    height: 6px;
  }

  .vk-loading-medium .vk-loading-dot {
    font-size: 24px;
  }

  .vk-loading-medium .vk-loading-dot .vk-loading-dot-item {
    width: 10px;
    height: 10px;
  }

  .vk-loading-default .vk-loading-dot {
    font-size: 32px;
  }

  .vk-loading-default .vk-loading-dot .vk-loading-dot-item {
    width: 14px;
    height: 14px;
  }

  @keyframes uniWaitMove {
    to {
      opacity: 1;
    }
  }

  @keyframes uniRotate {
    to {
      transform: rotate(405deg);
    }
  }

  @-webkit-keyframes uniWaitMove {
    to {
      opacity: 1;
    }
  }

  @-webkit-keyframes uniRotate {
    to {
      transform: rotate(405deg);
    }
  }

  // 圆环加载动画
  .circle-animation {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 10px auto;
    width: 50px;
    height: 50px;

    .circle-loader {
      width: 100%;
      height: 100%;
      border: 3px solid var(--animation-color-alpha);
      border-top: 3px solid var(--animation-color);
      border-radius: 50%;
      animation: circle-rotate 1s linear infinite;
    }
  }

  // 圆环加载动画 - mini尺寸
  .vk-loading-mini .circle-animation {
    width: 30px;
    height: 30px;

    .circle-loader {
      border-width: 2px;
    }
  }

  // 圆环加载动画 - medium尺寸
  .vk-loading-medium .circle-animation {
    width: 40px;
    height: 40px;

    .circle-loader {
      border-width: 2.5px;
    }
  }

  // 圆环加载动画 - default尺寸
  .vk-loading-default .circle-animation {
    width: 50px;
    height: 50px;

    .circle-loader {
      border-width: 3px;
    }
  }

  // 波浪加载动画
  .wave-animation {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 10px auto;
    width: 50px;
    height: 10px;

    .wave-loader {
      display: flex;
      align-items: center;
      gap: 6px;

      .wave-dot {
        width: 8px;
        height: 8px;
        background-color: var(--animation-color);
        border-radius: 50%;
        animation: wave-bounce 1.4s ease-in-out infinite both;
      }
    }
  }

  // 波浪加载动画 - mini尺寸
  .vk-loading-mini .wave-animation {
    width: 30px;
    height: 8px;

    .wave-loader {
      gap: 4px;

      .wave-dot {
        width: 6px;
        height: 6px;
      }
    }
  }

  // 波浪加载动画 - medium尺寸
  .vk-loading-medium .wave-animation {
    width: 40px;
    height: 9px;

    .wave-loader {
      gap: 5px;

      .wave-dot {
        width: 7px;
        height: 7px;
      }
    }
  }

  // 波浪加载动画 - default尺寸
  .vk-loading-default .wave-animation {
    width: 50px;
    height: 10px;

    .wave-loader {
      gap: 6px;

      .wave-dot {
        width: 8px;
        height: 8px;
      }
    }
  }

  // 图片加载动画
  .image {
    padding: 10px;
    width: 70px;
    height: 70px;
    display: block;
    margin-left: auto;
    margin-right: auto;
  }

  // 图片加载动画 - mini尺寸
  .vk-loading-mini .image {
    padding: 5px;
    width: 50px;
    height: 50px;
  }

  // 图片加载动画 - medium尺寸
  .vk-loading-medium .image {
    padding: 8px;
    width: 60px;
    height: 60px;
  }

  // 图片加载动画 - default尺寸
  .vk-loading-default .image {
    padding: 10px;
    width: 70px;
    height: 70px;
  }

  /* 圆环旋转动画 */
  @keyframes circle-rotate {
    0% {
      transform: rotate(0deg);
    }

    100% {
      transform: rotate(360deg);
    }
  }

  /* 波浪弹跳动画 */
  @keyframes wave-bounce {
    0%,
    80%,
    100% {
      transform: scale(0.8);
      opacity: 0.5;
    }

    40% {
      transform: scale(1.2);
      opacity: 1;
    }
  }
</style>
