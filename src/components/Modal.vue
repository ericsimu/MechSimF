<template>
  <teleport to="body">
    <div v-if="open" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-panel">
        <div class="modal-header">
          <h3>{{ title }}</h3>
          <button class="modal-close" @click="$emit('close')">&times;</button>
        </div>
        <div class="modal-body">
          <slot />
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'

defineProps({ open: Boolean, title: String })
const emit = defineEmits(['close'])

function onKey(e) { if (e.key === 'Escape') emit('close') }

onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.35);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.modal-panel {
  background: #fff; border-radius: 8px; width: 460px; max-width: 90vw;
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--border);
}
.modal-header h3 { font-size: 15px; font-weight: 600; }
.modal-close { background: none; font-size: 20px; color: #999; padding: 0 4px; }
.modal-body { padding: 20px; }
</style>
