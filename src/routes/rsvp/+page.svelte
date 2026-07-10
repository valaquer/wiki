<script lang="ts">
	import SpeedReader from '$lib/SpeedReader.svelte';
	import { onMount } from 'svelte';

	let pasteText = $state('');
	let ready = $state(false);

	onMount(() => {
		const stored = localStorage.getItem('rsvp-paste-text');
		localStorage.removeItem('rsvp-paste-text');
		pasteText = stored || '';
		ready = true;
	});
</script>

{#if ready}
	<SpeedReader pasteText={pasteText} />
{/if}
