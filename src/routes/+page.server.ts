import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const WIKI_DIR = "/Users/deepak-macmini/honeybloom/library/wiki";

interface WikiPage {
	slug: string;
	title: string;
	content: string;
	frontmatter: Record<string, string>;
}

interface SidebarPage {
	slug: string;
	title: string;
}

interface SidebarGroup {
	title: string;
	pages: SidebarPage[];
}

interface SidebarSection {
	title: string;
	groups: SidebarGroup[];
	pages: SidebarPage[];
}

function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; content: string } {
	const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!match) return { frontmatter: {}, content: raw };

	const fm: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		const m = line.match(/^([\w-]+):\s*(.+)$/);
		if (m) fm[m[1]] = m[2].trim();
	}
	return { frontmatter: fm, content: match[2] };
}

async function loadSidebarOrder(): Promise<string[]> {
	try {
		const raw = await readFile(path.join(WIKI_DIR, "SIDEBAR.md"), "utf-8");
		return raw
			.split("\n")
			.map((l) => l.replace(/^[-*]\s*/, "").trim())
			.filter((l) => l.length > 0 && !l.startsWith("#"));
	} catch {
		return [];
	}
}

export async function load() {
	const entries = await readdir(WIKI_DIR, { withFileTypes: true });
	const pages: Record<string, WikiPage> = {};
	const titleToSlug: Record<string, string> = {};

	// Root-level .md files (Home.md + any unsectioned files)
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "SIDEBAR.md") continue;
		const raw = await readFile(path.join(WIKI_DIR, entry.name), "utf-8");
		const slug = entry.name.replace(/\.md$/, "");
		const { frontmatter, content } = parseFrontmatter(raw);
		pages[slug] = { slug, title: slug, content, frontmatter };
		titleToSlug[slug] = slug;
	}

	// Section directories (top-level folders = sections)
	const sectionMap = new Map<string, { groups: Map<string, SidebarPage[]>; pages: SidebarPage[] }>();

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const sectionName = entry.name;
		const sectionPath = path.join(WIKI_DIR, sectionName);
		const sectionEntries = await readdir(sectionPath, { withFileTypes: true });

		if (!sectionMap.has(sectionName)) {
			sectionMap.set(sectionName, { groups: new Map(), pages: [] });
		}
		const sectionData = sectionMap.get(sectionName)!;

		// Files directly in section folder = section pages
		for (const subEntry of sectionEntries) {
			if (!subEntry.isFile() || !subEntry.name.endsWith(".md")) continue;
			const raw = await readFile(path.join(sectionPath, subEntry.name), "utf-8");
			const title = subEntry.name.replace(/\.md$/, "");
			const slug = `${sectionName}/${title}`;
			const { frontmatter, content } = parseFrontmatter(raw);
			pages[slug] = { slug, title, content, frontmatter };
			titleToSlug[title] = slug;
			sectionData.pages.push({ slug, title });
		}

		// Subdirectories within section = groups
		for (const subEntry of sectionEntries) {
			if (!subEntry.isDirectory()) continue;
			const groupName = subEntry.name;
			const groupPath = path.join(sectionPath, groupName);
			const groupFiles = await readdir(groupPath);

			if (!sectionData.groups.has(groupName)) {
				sectionData.groups.set(groupName, []);
			}
			const groupPages = sectionData.groups.get(groupName)!;

			for (const file of groupFiles.filter((f: string) => f.endsWith(".md")).sort()) {
				const raw = await readFile(path.join(groupPath, file), "utf-8");
				const title = file.replace(/\.md$/, "");
				const slug = `${sectionName}/${groupName}/${title}`;
				const { frontmatter, content } = parseFrontmatter(raw);
				pages[slug] = { slug, title, content, frontmatter };
				titleToSlug[title] = slug;
				groupPages.push({ slug, title });
			}
		}
	}

	const sidebarOrder = await loadSidebarOrder();

	// Build ordered sections array
	const sections: SidebarSection[] = [];
	const addedSections = new Set<string>();

	// First: sections in SIDEBAR.md order
	for (const sectionTitle of sidebarOrder) {
		const data = sectionMap.get(sectionTitle);
		if (!data) continue;

		const groups: SidebarGroup[] = [];
		for (const [groupTitle, groupPages] of data.groups) {
			groups.push({ title: groupTitle, pages: groupPages });
		}
		groups.sort((a, b) => a.title.localeCompare(b.title));

		sections.push({ title: sectionTitle, groups, pages: data.pages });
		addedSections.add(sectionTitle);
	}

	// Then: sections not in SIDEBAR.md (auto-appear at bottom, alphabetical)
	const unlisted = [...sectionMap.keys()]
		.filter((s) => !addedSections.has(s))
		.sort();

	for (const sectionTitle of unlisted) {
		const data = sectionMap.get(sectionTitle)!;
		const groups: SidebarGroup[] = [];
		for (const [groupTitle, groupPages] of data.groups) {
			groups.push({ title: groupTitle, pages: groupPages });
		}
		groups.sort((a, b) => a.title.localeCompare(b.title));

		sections.push({ title: sectionTitle, groups, pages: data.pages });
	}

	// Unsorted: root-level files (except Home)
	const unsortedPages: SidebarPage[] = [];
	for (const [slug, page] of Object.entries(pages)) {
		if (slug === "Home") continue;
		if (!slug.includes("/")) {
			unsortedPages.push({ slug, title: page.title });
		}
	}
	if (unsortedPages.length > 0) {
		sections.push({ title: "Unsorted", groups: [], pages: unsortedPages });
	}

	const validPages = new Set(Object.keys(pages));

	return {
		pages,
		sections,
		validPages: [...validPages],
		titleToSlug,
	};
}
