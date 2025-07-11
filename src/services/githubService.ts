
import { GITHUB_API_BASE_URL, MAX_FILE_SIZE_TO_FETCH_VIA_API, DEFAULT_IGNORE_PATTERNS_JS } from '@/constants';
// Removed GitHubUser import as it's no longer used here

interface GitHubTreeItem {
  path: string;
  type: 'blob' | 'tree' | 'commit'; // 'blob' is a file
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

interface GitHubFileResponse {
  sha: string;
  node_id: string;
  size: number;
  url: string;
  content: string; // Base64 encoded content
  encoding: 'base64' | 'utf-8' ; 
}

const globToRegex = (glob: string): RegExp => {
  const specialChars = /[.+?^${}()|[\]\\]/g; 
  let regexString = glob
    .replace(specialChars, '\\$&') 
    .replace(/\*\*/g, '.*')        
    .replace(/\*/g, '[^/]*')      
    .replace(/\?/g, '.');         

  if (glob.endsWith('/')) {
    regexString = `^${regexString.slice(0,-1)}(?:/.*|$)`;
  } else {
    regexString = `^${regexString}$`;
  }
  
  if (!glob.startsWith('*') && !glob.startsWith('**/') && !regexString.startsWith('^')) {
     regexString = `^${regexString}`;
  } else if (glob.startsWith('**/')) {
    regexString = regexString.substring(3); 
  }
  return new RegExp(regexString);
};

const ignoreRegexes = DEFAULT_IGNORE_PATTERNS_JS.map(globToRegex);

const isIgnored = (path: string): boolean => {
  const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
  
  for (const regex of ignoreRegexes) {
    if (regex.test(normalizedPath)) {
      return true;
    }
  }
  
  const binaryExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.ico', '.webp',
    '.mp3', '.wav', '.ogg', '.flac', '.aac',
    '.mp4', '.avi', '.mov', '.wmv', '.mkv', '.flv',
    '.zip', '.tar', '.tar.gz', '.gz', '.rar', '.7z', '.bz2', '.xz', '.tgz',
    '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.odt', '.odp', '.ods',
    '.exe', '.dll', '.so', '.dylib', '.o', '.obj', '.a', '.lib',
    '.jar', '.class', '.war', '.ear', '.pyc', '.pyo',
    '.iso', '.img', '.dmg', '.vdi', '.vmdk',
    '.ttf', '.otf', '.woff', '.woff2', '.eot',
    '.psd', '.ai', '.eps', '.svg', // SVG can be text, but often complex/large for LLM context
    '.db', '.sqlite', '.mdb', '.accdb',
    '.app', '.pkg',
    '.deb', '.rpm',
    '.dat', '.bin',
    '.wasm'
  ];
  if (binaryExtensions.some(ext => normalizedPath.toLowerCase().endsWith(ext))) {
    return true;
  }
  return false;
};


let githubToken: string | null = null;

export const githubService = {
  initialize: (token: string) => {
    githubToken = token;
  },

  parseRepoUrl: (repoUrl: string): { owner: string; repo: string; branch?: string } | null => {
    try {
      const url = new URL(repoUrl);
      if (url.hostname !== 'github.com') return null;
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length < 2) return null;
      
      const owner = pathParts[0];
      const repo = pathParts[1];
      let branch: string | undefined = undefined;

      if (pathParts.length > 3 && pathParts[2] === 'tree') {
        branch = pathParts[3];
      }
      else if (pathParts.length > 3 && pathParts[2] === 'blob') {
        branch = pathParts[3];
      }
      
      return { owner, repo, branch };
    } catch (error) {
      console.error('Invalid GitHub URL:', error);
      return null;
    }
  },

  getRepoTree: async (owner: string, repo: string, branch?: string): Promise<GitHubTreeItem[]> => {
    const fetchBranchTree = async (branchName: string) => {
      const url = `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/git/trees/${branchName}?recursive=1`;
      const headers: HeadersInit = {};
      if (githubToken) {
        headers['Authorization'] = `token ${githubToken}`;
      }
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch repository tree from GitHub API (branch: ${branchName}). Status: ${response.status}`);
      }
      const data: GitHubTreeResponse = await response.json();
      return data.tree.filter(item => item.path && item.type === 'blob' && !isIgnored(item.path) && item.size !== undefined && item.size < MAX_FILE_SIZE_TO_FETCH_VIA_API && item.size > 0);
    };

    try {
      if (branch) {
        return await fetchBranchTree(branch);
      } else {
        // Try 'main' first, then 'master' as a common fallback for default branches
        try {
          return await fetchBranchTree('main');
        } catch (mainError: any) {
           if (mainError.message.includes('404') || mainError.message.includes('No commit found')) {
            console.warn("Branch 'main' not found, trying 'master'.");
            return await fetchBranchTree('master');
          }
          throw mainError; 
        }
      }
    } catch (error) {
      console.error('GitHub API getRepoTree error:', error);
      throw error;
    }
  },

  getFileContent: async (owner: string, repo: string, fileSha: string): Promise<string | null> => {
    const url = `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/git/blobs/${fileSha}`;
    const headers: HeadersInit = {};
    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        console.warn(`Failed to fetch file content (SHA: ${fileSha}) from GitHub API. Status: ${response.status}`);
        return null;
      }
      const data: GitHubFileResponse = await response.json();
      if (data.encoding === 'base64') {
        if (typeof window !== 'undefined' && typeof window.atob === 'function') {
          try {
            const binaryString = window.atob(data.content);
            // Check for common non-text patterns early (optional, simplistic)
            // A more robust check might involve looking for many non-printable ASCII chars
            if (binaryString.length > 100 && binaryString.substring(0,100).includes('\0')) { // Null bytes often indicate binary
                 console.warn(`File ${fileSha} appears to be binary after base64 decoding (contains null bytes).`);
                 return `Error: Content for ${fileSha} (base64 decoded) appears to be binary.`;
            }
            const charData = binaryString.split('').map(c => c.charCodeAt(0));
            const byteArray = new Uint8Array(charData);
            return new TextDecoder('utf-8', { fatal: false }).decode(byteArray); // fatal:false to prevent throwing on invalid UTF-8
          } catch (e) {
             console.error(`Error decoding base64 content for ${fileSha} with atob/TextDecoder:`, e);
            return `Error: Content for ${fileSha} (base64) could not be decoded reliably. It might be binary or contain non-UTF8 characters.`;
          }
        } else {
          console.error('window.atob not available for base64 decoding.');
          return `Error: Base64 content for ${fileSha} could not be decoded (atob missing).`;
        }
      } else if (data.encoding === 'utf-8') {
         // Even if marked utf-8, it could still be something else mislabelled.
         // A simple check for null bytes can be done here too.
         if (data.content.includes('\0')) {
            console.warn(`File ${fileSha} (utf-8) contains null bytes, may be binary.`);
            return `Error: Content for ${fileSha} (marked utf-8) contains null bytes, indicating it might be binary.`;
         }
         return data.content; 
      }
      console.warn(`Unexpected encoding or missing content for blob ${fileSha}: ${data.encoding}`);
      return `Error: Content for ${fileSha} has an unsupported encoding '${data.encoding}'.`;
    } catch (error) {
      console.error(`GitHub API getFileContent error for SHA ${fileSha}:`, error);
      return null; 
    }
  },
  // getUserProfile function removed as it requires authentication
};
