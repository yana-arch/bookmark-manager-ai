
import { BookmarkNode } from '../types';

const parseDl = (dlElement: HTMLDListElement): BookmarkNode[] => {
  const items: BookmarkNode[] = [];
  // Direct children of DL are DT elements
  const children = Array.from(dlElement.children).filter(el => el.tagName === 'DT');

  for (const dt of children) {
    const a = dt.querySelector('a');
    const h3 = dt.querySelector('h3');
    const nestedDl = dt.querySelector('dl');

    if (h3) { // It's a folder
      items.push({
        id: crypto.randomUUID(),
        type: 'folder',
        name: h3.textContent || 'Untitled Folder',
        addDate: h3.getAttribute('ADD_DATE') || undefined,
        lastModified: h3.getAttribute('LAST_MODIFIED') || undefined,
        children: nestedDl ? parseDl(nestedDl) : [],
      });
    } else if (a) { // It's a bookmark
      items.push({
        id: crypto.randomUUID(),
        type: 'bookmark',
        title: a.textContent || 'Untitled Bookmark',
        url: a.href,
        addDate: a.getAttribute('ADD_DATE') || undefined,
        icon: a.getAttribute('ICON') || undefined,
        tags: a.getAttribute('TAGS')?.split(',').filter(Boolean) || [],
      });
    }
  }
  return items;
};

export const parseBookmarksHTML = (htmlString: string): BookmarkNode[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const mainDl = doc.querySelector('dl');
  if (!mainDl) return [];
  return parseDl(mainDl);
};


const generateNodeHtml = (node: BookmarkNode, indentLevel: number): string => {
  const indent = '    '.repeat(indentLevel);
  if (node.type === 'folder') {
    const addDate = node.addDate ? ` ADD_DATE="${node.addDate}"` : '';
    const lastModified = node.lastModified ? ` LAST_MODIFIED="${node.lastModified}"` : '';
    return `${indent}<DT><H3${addDate}${lastModified}>${node.name}</H3>\n${indent}    <DL><p>\n${node.children.map(child => generateNodeHtml(child, indentLevel + 2)).join('')}${indent}    </DL><p>\n`;
  } else { // bookmark
    const addDate = node.addDate ? ` ADD_DATE="${node.addDate}"` : '';
    const icon = node.icon ? ` ICON="${node.icon}"` : '';
    const tags = node.tags.length > 0 ? ` TAGS="${node.tags.join(',')}"` : '';
    return `${indent}<DT><A HREF="${node.url}"${addDate}${icon}${tags}>${node.title}</A>\n`;
  }
};


export const exportBookmarksToHTML = (bookmarks: BookmarkNode[]): string => {
  const header = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;
  const footer = `</DL><p>\n`;
  const body = bookmarks.map(node => generateNodeHtml(node, 1)).join('');
  return header + body + footer;
};
