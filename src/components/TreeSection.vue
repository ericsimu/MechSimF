<template>
  <div class="tree-section">
    <div class="tree-section-header" @click="$emit('toggle')">
      <span class="tree-section-arrow">{{ expanded ? '▼' : '▶' }}</span>
      <span class="tree-section-title">{{ title }}</span>
    </div>
    <div v-if="expanded" class="tree-section-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; expanded: boolean }>()
defineEmits<{ toggle: [] }>()
</script>

<style scoped>
.tree-section { border-bottom: 1px solid var(--border); }
.tree-section-header {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 16px; cursor: pointer; user-select: none;
  font-size: 14px; font-weight: 500; color: var(--text);
  transition: background 0.12s;
}
.tree-section-header:hover { background: #f5f7fa; }
.tree-section-arrow { width: 14px; font-size: 10px; color: var(--text-secondary); flex-shrink: 0; }
.tree-section-title { flex: 1; }
</style>
