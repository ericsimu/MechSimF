<template>
  <teleport to="body">
    <transition name="modal-fade">
      <div v-if="open" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-panel" :style="{ width: width + 'px' }">
          <div class="modal-header">
            <h3>{{ title }}</h3>
          </div>
          <div class="modal-body">
            <slot />
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

defineProps<{
  open: boolean
  title: string
  width?: number
}>()
const emit = defineEmits<{ close: [] }>()

function onKey(e: KeyboardEvent): void { if (e.key === 'Escape') emit('close') }

onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.modal-fade-enter-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from { opacity: 0; }
.modal-fade-leave-active { transition: opacity 0.1s ease; }
.modal-fade-leave-to { opacity: 0; }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.3);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.modal-panel {
  background: #fff; border-radius: 8px; max-width: 90vw;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
.modal-header {
  padding: 16px 24px;
  border-bottom: 2px solid var(--accent);
}
.modal-header h3 { font-size: 15px; font-weight: 600; color: var(--accent); }
.modal-body { padding: 24px; }
</style>
