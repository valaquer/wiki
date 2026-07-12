<script lang="ts">
	import { marked } from 'marked';
	import { ChevronDown, ChevronUp, Gauge, Files } from 'lucide-svelte';
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
	let sections = $derived(data.sections);
	let validPages = $derived(new Set(data.validPages));
	let titleToSlug = $derived(data.titleToSlug as Record<string, string>);

	let selectedPage = $state('Home');
	let expandedSection: string | null = $state(null);
	let hoveredSlug: string | null = $state(null);

	$effect(() => {
		if (typeof localStorage !== 'undefined') {
			const stored = localStorage.getItem('wiki-expanded-section');
			if (stored) {
				expandedSection = stored;
			}
		}
	});

	function toggleSection(title: string) {
		expandedSection = expandedSection === title ? null : title;
		if (typeof localStorage !== 'undefined') {
			if (expandedSection) {
				localStorage.setItem('wiki-expanded-section', expandedSection);
			} else {
				localStorage.removeItem('wiki-expanded-section');
			}
		}
	}

	function speedRead(slug: string, e: MouseEvent) {
		e.stopPropagation();
		const page = pages[slug];
		if (!page) return;
		const filePath = `/Users/deepak-macmini/honeybloom/library/wiki/${slug}.md`;
		// Primer handles session ID generation + tab opening
		fetch('http://192.168.0.186:51730/api/speed-reader-start', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ filePath }),
		}).catch(() => {});
	}

	function selectPage(slug: string) {
		selectedPage = slug;
		const pane = document.querySelector('.wiki-reading-pane');
		if (pane) pane.scrollTop = 0;
	}

	function renderMarkdown(content: string): string {
		const processed = content.replace(/\[\[([^\]]+)\]\]/g, (_, raw) => {
			const rawSlug = raw.includes('|') ? raw.split('|')[0] : raw;
			const display = raw.includes('|') ? raw.split('|')[1] : raw;
			// Resolve by direct slug match first, then by title lookup
			const resolved = validPages.has(rawSlug) ? rawSlug : titleToSlug[rawSlug];
			if (resolved) {
				return `<a class="wikilink" data-page="${resolved}" href="#">${display}</a>`;
			}
			return display;
		});
		return marked.parse(processed, { async: false }) as string;
	}

	function handleClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.classList.contains('wikilink')) {
			e.preventDefault();
			const page = target.getAttribute('data-page');
			if (page && (validPages.has(page) || titleToSlug[page])) {
				selectPage(validPages.has(page) ? page : titleToSlug[page]);
			}
		}
	}

	let copyFlashSlug: string | null = $state(null);

	function copyPath(slug: string, e: MouseEvent) {
		e.stopPropagation();
		const path = `Locate this article in the wiki: /Users/deepak-macmini/honeybloom/library/wiki/${slug}.md`;
		try { navigator.clipboard.writeText(path); } catch {
			const ta = document.createElement('textarea');
			ta.value = path;
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			document.body.removeChild(ta);
		}
		copyFlashSlug = slug;
		setTimeout(() => { copyFlashSlug = null; }, 1500);
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

		<div class="wiki-nav-row" onmouseenter={() => hoveredSlug = 'Home'} onmouseleave={() => hoveredSlug = null}>
			<button
				class="wiki-nav-item wiki-nav-home"
				class:active={selectedPage === 'Home'}
				onclick={() => selectPage('Home')}
			>
				Home
			</button>
			{#if hoveredSlug === 'Home'}
				<button class="wiki-speed-btn wiki-speed-visible" onclick={(e) => copyPath('Home', e)} title="Copy path">
					<Files size={14} color={copyFlashSlug === 'Home' ? '#7a5e4a' : '#555'} />
				</button>
				<button class="wiki-speed-btn wiki-speed-visible" onclick={(e) => speedRead('Home', e)} title="Speed read">
					<Gauge size={14} color="#555" />
				</button>
			{/if}
		</div>

		{#each sections as section}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="wiki-section-header wiki-section-toggle" onclick={() => toggleSection(section.title)}>
				<p style="display: inline-block; font-size: 13px; font-weight: 500; font-family: var(--font-sans); background: var(--gradient-accent); background-repeat: no-repeat; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">{section.title}</p>
				<span class="wiki-chevron">
					{#if expandedSection === section.title}
						<ChevronUp size={12} color="#7a5e4a" />
					{:else}
						<ChevronDown size={12} color="#7a5e4a" />
					{/if}
				</span>
			</div>

			{#if expandedSection === section.title}
				{#each section.pages as page}
					<div class="wiki-nav-row" onmouseenter={() => hoveredSlug = page.slug} onmouseleave={() => hoveredSlug = null}>
						<button
							class="wiki-nav-item wiki-nav-child"
							class:active={selectedPage === page.slug}
							onclick={() => selectPage(page.slug)}
						>
							{page.title}
						</button>
						{#if hoveredSlug === page.slug}
							<button class="wiki-speed-btn wiki-speed-visible" onclick={(e) => copyPath(page.slug, e)} title="Copy path">
								<Files size={14} color={copyFlashSlug === page.slug ? '#7a5e4a' : '#555'} />
							</button>
							<button class="wiki-speed-btn wiki-speed-visible" onclick={(e) => speedRead(page.slug, e)} title="Speed read">
								<Gauge size={14} color="#555" />
							</button>
						{/if}
					</div>
				{/each}

				{#each section.groups as group}
					<div class="wiki-nav-group-label">{group.title}</div>
					{#each group.pages as page}
						<div class="wiki-nav-row" onmouseenter={() => hoveredSlug = page.slug} onmouseleave={() => hoveredSlug = null}>
							<button
								class="wiki-nav-item wiki-nav-grouped-child"
								class:active={selectedPage === page.slug}
								onclick={() => selectPage(page.slug)}
							>
								{page.title}
							</button>
							{#if hoveredSlug === page.slug}
								<button class="wiki-speed-btn wiki-speed-visible" onclick={(e) => copyPath(page.slug, e)} title="Copy path">
									<Files size={14} color={copyFlashSlug === page.slug ? '#7a5e4a' : '#555'} />
								</button>
								<button class="wiki-speed-btn wiki-speed-visible" onclick={(e) => speedRead(page.slug, e)} title="Speed read">
									<Gauge size={14} color="#555" />
								</button>
							{/if}
						</div>
					{/each}
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
				<div class="wiki-cache-code">Cache Code: F4D</div>
			</div>
		</div>
	</main>
</div>

<style>
	.wiki-root {
		display: grid;
		grid-template-columns: 320px calc(50vw - 605px) 570px;
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

	.wiki-section-toggle {
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.wiki-section-toggle:hover {
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
		flex-shrink: 0;
	}

	.wiki-speed-visible {
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

	.wiki-nav-group-label {
		padding: 0.5rem 1rem 0.25rem 2.5rem;
		font-size: 11px;
		color: #7a5e4a;
		font-family: var(--font-sans);
		text-transform: lowercase;
	}

	.wiki-nav-grouped-child {
		padding-left: 3.5rem;
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
