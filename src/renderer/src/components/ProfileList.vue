<template>
    <div class="layout">
        <div class="main-list" id="profileList" :class="{ 'grid-view': isGridView }">
            <template v-if="filteredProfiles.length > 0">
                <div
                    v-for="profile in filteredProfiles"
                    :key="profile.id"
                    class="profile-drag-shell"
                    :class="{ dragging: draggedId === profile.id, 'drop-before': dropTargetId === profile.id && dropPosition === 'before', 'drop-after': dropTargetId === profile.id && dropPosition === 'after' }"
                    draggable="true"
                    @dragstart="handleDragStart($event, profile.id)"
                    @dragover="handleDragOver($event, profile.id)"
                    @dragleave="handleDragLeave(profile.id)"
                    @drop="handleDrop($event, profile.id)"
                    @dragend="handleDragEnd"
                >
                    <ProfileCard
                        :profile="profile"
                        :isRunning="profileStore.isRunning(profile.id)"
                        :isLaunching="profileStore.isLaunching(profile.id)"
                        :isSelected="profileStore.isSelected(profile.id)"
                    />
                </div>
            </template>
            <div v-else class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <div class="empty-state-text">{{ emptyMessage }}</div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useProfileStore } from '../store/useProfileStore';
import ProfileCard from './ProfileCard.vue';

const profileStore = useProfileStore();

const filteredProfiles = computed(() => profileStore.filteredProfiles);
const isGridView = computed(() => profileStore.viewMode === 'grid');
const draggedId = ref('');
const dropTargetId = ref('');
const dropPosition = ref('after');

const emptyMessage = computed(() => {
    const t = window.t || ((key) => key);
    if (profileStore.searchText.length > 0) {
        return "No Search Results";
    }
    return t('emptyStateMsg');
});

onMounted(() => {
    profileStore.loadProfiles();
});

function canStartDrag(event) {
    return !event.target?.closest?.('.no-drag, button, input, select, textarea, a');
}

function resetDragState() {
    draggedId.value = '';
    dropTargetId.value = '';
    dropPosition.value = 'after';
}

function handleDragStart(event, profileId) {
    if (!canStartDrag(event)) {
        event.preventDefault();
        return;
    }
    draggedId.value = profileId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', profileId);
}

function handleDragOver(event, profileId) {
    if (!draggedId.value || draggedId.value === profileId) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    dropTargetId.value = profileId;
    const beforeTarget = isGridView.value
        ? event.clientX < rect.left + rect.width / 2
        : event.clientY < rect.top + rect.height / 2;
    dropPosition.value = beforeTarget ? 'before' : 'after';
    event.dataTransfer.dropEffect = 'move';
}

function handleDragLeave(profileId) {
    if (dropTargetId.value === profileId) {
        dropTargetId.value = '';
    }
}

async function handleDrop(event, profileId) {
    event.preventDefault();
    const sourceId = draggedId.value || event.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === profileId) {
        resetDragState();
        return;
    }

    const visibleIds = filteredProfiles.value.map(profile => profile.id);
    const sourceIndex = visibleIds.indexOf(sourceId);
    const targetIndex = visibleIds.indexOf(profileId);
    if (sourceIndex === -1 || targetIndex === -1) {
        resetDragState();
        return;
    }

    const nextVisibleIds = [...visibleIds];
    nextVisibleIds.splice(sourceIndex, 1);
    const adjustedTargetIndex = nextVisibleIds.indexOf(profileId);
    nextVisibleIds.splice(dropPosition.value === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1, 0, sourceId);

    const reorderedVisible = new Set(nextVisibleIds);
    const queue = [...nextVisibleIds];
    const allIds = profileStore.profiles.map(profile => profile.id);
    const nextAllIds = allIds.map(id => reorderedVisible.has(id) ? queue.shift() : id);

    try {
        await profileStore.reorderProfiles(nextAllIds);
    } catch (e) {
        const t = window.t || ((key) => key);
        window.uiStore?.showAlert?.(t('profileReorderFailed') || 'Failed to save profile order');
    } finally {
        resetDragState();
    }
}

function handleDragEnd() {
    resetDragState();
}
</script>
