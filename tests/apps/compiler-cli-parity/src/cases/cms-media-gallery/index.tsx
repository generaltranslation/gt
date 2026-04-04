import { Plural, Num } from 'gt-react';

export default function CmsMediaGallery() {
  const files = [
    { id: 1, name: 'hero-banner.png', size: '2.4 MB', dimensions: '1920x1080', uploaded: 'Mar 10, 2024' },
    { id: 2, name: 'product-photo.jpg', size: '850 KB', dimensions: '800x800', uploaded: 'Mar 8, 2024' },
  ];
  const totalFiles = 156;
  const storageUsed = 4.2;
  const storageLimit = 10;
  const selectedCount = 0;

  return (
    <main>
      <header>
        <h1>Media Library</h1>
        <div>
          <span>
            <Num>{totalFiles}</Num>{' '}
            <Plural n={totalFiles} one="file" other="files" />
          </span>
          <span> — </span>
          <span>{storageUsed} GB of {storageLimit} GB used</span>
        </div>
        <div>
          <button>Upload files</button>
          {selectedCount > 0 && (
            <button>
              Delete selected ({selectedCount})
            </button>
          )}
        </div>
      </header>

      <div>
        <input type="search" placeholder="Search files..." />
        <select>
          <option>All types</option>
          <option>Images</option>
          <option>Videos</option>
          <option>Documents</option>
        </select>
        <select>
          <option>Newest first</option>
          <option>Oldest first</option>
          <option>Largest first</option>
        </select>
      </div>

      <div>
        {files.map((file) => (
          <div key={file.id}>
            <img src={`/thumb/${file.id}`} alt={file.name} />
            <div>
              <p><strong>{file.name}</strong></p>
              <p>{file.size} — {file.dimensions}</p>
              <p>Uploaded {file.uploaded}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
