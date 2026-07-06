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

function extractWikilinks(content: string): string[] {
	const links: string[] = [];
	const re = /\[\[([^\]]+)\]\]/g;
	let m;
	while ((m = re.exec(content)) !== null) {
		const raw = m[1];
		const slug = raw.includes("|") ? raw.split("|")[0] : raw;
		links.push(slug);
	}
	return links;
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
	const files = await readdir(WIKI_DIR);
	const mdFiles = files.filter((f) => f.endsWith(".md") && f !== "SIDEBAR.md").sort();

	const pages: Record<string, WikiPage> = {};

	for (const file of mdFiles) {
		const raw = await readFile(path.join(WIKI_DIR, file), "utf-8");
		const slug = file.replace(/\.md$/, "");
		const { frontmatter, content } = parseFrontmatter(raw);
		pages[slug] = { slug, title: slug, content, frontmatter };
	}

	const sidebarOrder = await loadSidebarOrder();

	// Build sections from frontmatter
	const sectionMap = new Map<string, { groups: Map<string, SidebarPage[]>; pages: SidebarPage[] }>();

	for (const [slug, page] of Object.entries(pages)) {
		if (slug === "Home") continue;

		const section = page.frontmatter.section;
		if (!section) continue;

		if (!sectionMap.has(section)) {
			sectionMap.set(section, { groups: new Map(), pages: [] });
		}

		const sectionData = sectionMap.get(section)!;
		const group = page.frontmatter.group;

		if (group) {
			if (!sectionData.groups.has(group)) sectionData.groups.set(group, []);
			sectionData.groups.get(group)!.push({ slug, title: slug });
		} else {
			sectionData.pages.push({ slug, title: slug });
		}
	}

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

	// Unsorted: pages without section
	const unsortedPages: SidebarPage[] = [];
	for (const [slug, page] of Object.entries(pages)) {
		if (slug === "Home") continue;
		if (!page.frontmatter.section) {
			unsortedPages.push({ slug, title: slug });
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
	};
}
