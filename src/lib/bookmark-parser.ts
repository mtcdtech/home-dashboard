import * as cheerio from "cheerio";

export interface ImportedBookmark {
  title: string;
  url: string;
  icon?: string;
}

export interface ImportedFolder {
  name: string;
  bookmarks: ImportedBookmark[];
}

const TECHNICAL_FOLDERS = [
  "Bookmarks bar",
  "Other bookmarks",
  "Mobile bookmarks",
  "Favorites bar",
  "Reading list",
  "Bookmarks Menu",
  "Toolbar",
  "Unsorted Bookmarks"
];

const FORBIDDEN_PROTOCOLS = /^(javascript|data|vbscript|file):/i;

export async function parseBookmarksHtml(html: string): Promise<ImportedFolder[]> {
  const $ = cheerio.load(html);
  const folders: ImportedFolder[] = [];

  // Finding all H3 elements which usually represent folders
  $("h3").each((_, element) => {
    const folderName = $(element).text().trim();
    
    // Filter out technical folders
    if (TECHNICAL_FOLDERS.some(f => folderName.toLowerCase() === f.toLowerCase())) {
      return;
    }

    const bookmarks: ImportedBookmark[] = [];
    
    // The structure is typically <DT><H3>Folder</H3><DL><DT><A>...
    // We look for the next <DL> sibling
    const dl = $(element).parent().next("dl");
    if (dl.length > 0) {
      dl.find("a").each((_, a) => {
        const title = $(a).text().trim();
        const url = $(a).attr("href");
        const icon = $(a).attr("icon"); // Favicons are often Base64 encoded here

        if (url && !FORBIDDEN_PROTOCOLS.test(url.trim())) {
          bookmarks.push({ title, url: url.trim(), icon });
        }
      });
    }

    if (bookmarks.length > 0) {
      folders.push({ name: folderName, bookmarks });
    }
  });

  // Also look for top-level bookmarks (not in a folder)
  const topLevelBookmarks: ImportedBookmark[] = [];
  // These are typically <a> tags directly inside the main <body> <dl> not inside another <dl>
  // This is a bit harder with cheerio so we'll just gather all <a> but only keep ones not processed
  // For the first version, let's just create an "Imported" folder for everything else if folder mapping isn't used
  
  return folders;
}
