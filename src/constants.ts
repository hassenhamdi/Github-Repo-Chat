
export const GEMINI_MODEL_NAME = 'gemini-2.5-flash';
// Max context length to aim for when sending to Gemini (in characters, approximate)
export const MAX_CONTEXT_LENGTH_CHAR = 30000; 
// Max length for a single file's content to be included in context (characters)
export const MAX_FILE_CONTENT_LENGTH_CHAR = 10000;

// GitHub API related constants
export const GITHUB_API_BASE_URL = 'https://api.github.com';
export const MAX_FILES_TO_FETCH_VIA_API = 200; // Limit number of files fetched to avoid rate limits/long waits
export const MAX_FILE_SIZE_TO_FETCH_VIA_API = 1 * 1024 * 1024; // 1MB, GitHub API limit for blob content is higher, but good to have a client cap

// Simplified ignore patterns for JS client-side filtering (mimics gitingest's defaults)
export const DEFAULT_IGNORE_PATTERNS_JS: string[] = [
  // Version control
  '.git/', '.svn/', '.hg/', '.gitignore', '.gitattributes', '.gitmodules',
  // Common binary extensions
  '*.jpg', '*.jpeg', '*.png', '*.gif', '*.bmp', '*.tiff', '*.ico',
  '*.mp3', '*.wav', '*.ogg', '*.flac',
  '*.mp4', '*.avi', '*.mov', '*.wmv', '*.mkv',
  '*.zip', '*.tar.gz', '*.gz', '*.rar', '*.7z', '*.bz2',
  '*.pdf', '*.doc', '*.docx', '*.ppt', '*.pptx', '*.xls', '*.xlsx',
  '*.exe', '*.dll', '*.so', '*.dylib', '*.o', '*.obj',
  '*.jar', '*.class', '*.war', '*.ear',
  '*.iso', '*.img', '*.dmg',
  '*.ttf', '*.otf', '*.woff', '*.woff2', '*.eot',
  // IDE/Editor specific
  '.idea/', '.vscode/', '*.swp', '*.swo', '.DS_Store',
  // Dependency folders / lock files
  'node_modules/', 'bower_components/', 'vendor/',
  'package-lock.json', 'yarn.lock', 'composer.lock', 'Gemfile.lock', 'Poetry.lock', 'Pipfile.lock',
  // Build output
  'dist/', 'build/', 'out/', 'target/', 'bin/',
  // Logs & temp
  '*.log', '*.tmp', '*.temp', '*.bak',
  // Python specific
  '__pycache__/', '*.pyc', '*.pyo', '.pytest_cache/', '.coverage', '.tox/',
  // Gitingest specific (if it were to generate one within itself)
  'digest.txt',
  // Font files
  '*.otf', '*.eot', '*.woff', '*.woff2', '*.ttf',
  // Image files (more comprehensive)
  '*.svg', 
  // Minified files and source maps
  '*.min.js', '*.min.css', '*.map',
];
