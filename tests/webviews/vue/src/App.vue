<script setup lang="ts">
import { onMounted } from 'vue';
import { aurora } from '@aurora-mp/webview';

const RAGE_IN_WINDOW = 'mp' in window;

onMounted(() => {
    if (RAGE_IN_WINDOW) {
        aurora.emitServer('webview:init');
    }
});
</script>

<template>
    <h1>Aurora Multiplayer - Vue</h1>
</template>
