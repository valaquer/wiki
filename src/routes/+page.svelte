<script lang="ts">
	import { marked } from 'marked';
	import { ChevronDown, ChevronUp, Gauge } from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';

	marked.setOptions({ breaks: true, gfm: true });

	let eventSource: EventSource | null = null;

	onMount(() => {
		eventSource = new EventSource('/api/wiki-watch');
		eventSource.onmessage = (e) => {
			if (e.data === 'connected') return;
			invalidateAll();
		};
	});

	onDestroy(() => {
		if (eventSource) eventSource.close();
	});

	let { data } = $props();
	let pages = $derived(data.pages);
	let navigation = $derived(data.navigation);
	let validPages = $derived(new Set(data.validPages));

	let selectedPage = $state('Home');
	let expandedHub: string | null = $state(null);

	$effect(() => {
		if (typeof localStorage !== 'undefined') {
			const stored = localStorage.getItem('wiki-expanded-hub');
			if (stored) {
				expandedHub = stored;
			}
		}
	});

	function toggleHub(hubTitle: string) {
		expandedHub = expandedHub === hubTitle ? null : hubTitle;
		if (typeof localStorage !== 'undefined') {
			if (expandedHub) {
				localStorage.setItem('wiki-expanded-hub', expandedHub);
			} else {
				localStorage.removeItem('wiki-expanded-hub');
			}
		}
		selectPage(hubTitle);
	}

	function speedRead(slug: string, e: MouseEvent) {
		e.stopPropagation();
		const page = pages[slug];
		if (!page) return;
		localStorage.setItem('rsvp-paste-text', page.content);
		window.open('/rsvp', '_blank');
	}

	function selectPage(slug: string) {
		selectedPage = slug;
		const pane = document.querySelector('.wiki-reading-pane');
		if (pane) pane.scrollTop = 0;
	}

	function renderMarkdown(content: string): string {
		const processed = content.replace(/\[\[([^\]]+)\]\]/g, (_, name) => {
			if (validPages.has(name)) {
				return `<a class="wikilink" data-page="${name}" href="#">${name}</a>`;
			}
			return name;
		});
		return marked.parse(processed, { async: false }) as string;
	}

	function handleClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.classList.contains('wikilink')) {
			e.preventDefault();
			const page = target.getAttribute('data-page');
			if (page && validPages.has(page)) {
				selectPage(page);
			}
		}
	}

	let currentPage = $derived(pages[selectedPage]);
	let renderedContent = $derived(currentPage ? renderMarkdown(currentPage.content) : '');
</script>

<svelte:head>
	<title>Wiki</title>
</svelte:head>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="wiki-root" onclick={handleClick}>
	<!-- Sidebar -->
	<nav class="wiki-sidebar">
		<div class="wiki-section-header">
			<p style="display: inline-block; font-size: 13px; font-weight: 500; font-family: var(--font-sans); background: var(--gradient-accent); background-repeat: no-repeat; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Our Wiki</p>
		</div>

		<div class="wiki-nav-row">
			<button
				class="wiki-nav-item wiki-nav-home"
				class:active={selectedPage === 'Home'}
				onclick={() => selectPage('Home')}
			>
				Home
			</button>
			<button class="wiki-speed-btn" onclick={(e) => speedRead('Home', e)} title="Speed read">
				<Gauge size={14} color="#555" />
			</button>
		</div>

		{#each navigation as hub}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="wiki-section-header wiki-hub-header" onclick={() => toggleHub(hub.title)}>
				<p style="display: inline-block; font-size: 13px; font-weight: 500; font-family: var(--font-sans); background: var(--gradient-accent); background-repeat: no-repeat; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">{hub.title}</p>
				<span class="wiki-chevron">
					{#if expandedHub === hub.title}
						<ChevronUp size={12} color="#7a5e4a" />
					{:else}
						<ChevronDown size={12} color="#7a5e4a" />
					{/if}
				</span>
			</div>

			{#if expandedHub === hub.title}
				{#each hub.children as child}
					<div class="wiki-nav-row">
						<button
							class="wiki-nav-item wiki-nav-child"
							class:active={selectedPage === child.slug}
							onclick={() => selectPage(child.slug)}
						>
							{child.title}
						</button>
						<button class="wiki-speed-btn" onclick={(e) => speedRead(child.slug, e)} title="Speed read">
							<Gauge size={14} color="#555" />
						</button>
					</div>
				{/each}
			{/if}
		{/each}
	</nav>

	<!-- Gap -->
	<div></div>

	<!-- Reading Pane -->
	<main class="wiki-reading-pane">
		<div style="display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 0 12px;">
			<div></div>
			<div>
				{#if currentPage}
					{#if currentPage.frontmatter['last-verified'] || currentPage.frontmatter.tags}
						<div class="wiki-meta-bar">
							{#if currentPage.frontmatter['last-verified']}
								<span class="wiki-meta-tag">Verified: {currentPage.frontmatter['last-verified']}</span>
							{/if}
							{#if currentPage.frontmatter.tags}
								<span class="wiki-meta-tag">{currentPage.frontmatter.tags}</span>
							{/if}
						</div>
					{/if}
					<article class="md-content" style="padding-left: 1.5rem; border-left: 2px solid transparent;">
						{@html renderedContent}
					</article>
				{/if}
				<div class="wiki-cache-code">Cache Code: T5B</div>
			</div>
		</div>
	</main>
</div>

<style>
	.wiki-root {
		display: grid;
		grid-template-columns: 280px calc(50vw - 565px) 570px;
		height: 100vh;
		background: var(--color-bg);
		color: var(--color-text);
	}

	/* Sidebar */
	.wiki-sidebar {
		background: var(--color-bg-panel);
		border-right: 1px dashed var(--color-bg-step4);
		padding: 1rem 0;
		overflow-y: auto;
		height: 100vh;
		font-family: var(--font-sans);
	}

	.wiki-section-header {
		padding: 1rem 1rem 1rem 1.5rem;
		border-bottom: 1px dashed var(--color-bg-step4);
	}

	.wiki-hub-header {
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.wiki-hub-header:hover {
		background: rgba(255, 255, 255, 0.02);
	}

	.wiki-chevron {
		display: flex;
		align-items: center;
		padding-right: 0.5rem;
	}

	.wiki-nav-row {
		display: flex;
		align-items: center;
	}

	.wiki-speed-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0 0.5rem;
		opacity: 0;
		transition: opacity 0.15s;
		flex-shrink: 0;
	}

	.wiki-nav-row:hover .wiki-speed-btn {
		opacity: 1;
	}

	.wiki-nav-item {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		font: inherit;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0 1rem 0 1.5rem;
		text-transform: lowercase;
		transition: color 0.15s;
	}

	.wiki-nav-item:hover {
		color: var(--color-text);
	}

	.wiki-nav-item.active {
		color: var(--color-text);
		background: rgba(122, 94, 74, 0.15);
		border-left: 2px solid #7a5e4a;
	}

	.wiki-nav-home {
		font-weight: 500;
		margin-bottom: 0.5rem;
	}

	.wiki-nav-child {
		padding-left: 2.5rem;
	}

	/* Reading Pane */
	.wiki-reading-pane {
		padding: 2rem 0 2rem 0;
		overflow-y: auto;
		height: 100vh;
	}

	.wiki-meta-bar {
		display: flex;
		gap: 1rem;
		margin-bottom: 1.5rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px dashed var(--color-bg-step4);
	}

	.wiki-meta-tag {
		font-size: 11px;
		color: #777;
		font-family: var(--font-mono);
	}

	.wiki-cache-code {
		margin-top: 3rem;
		font-size: 10px;
		color: #333;
		font-family: var(--font-mono);
	}

	/* Wikilink styling */
	.wiki-reading-pane :global(.wikilink) {
		color: #7a5e4a;
		text-decoration: none;
		cursor: pointer;
	}

	.wiki-reading-pane :global(.wikilink:hover) {
		color: #a8836a;
		text-decoration: underline;
	}
</style>
