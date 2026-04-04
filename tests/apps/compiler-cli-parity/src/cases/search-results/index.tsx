export default function SearchResults() {
  const query = 'laptop';
  const total = 156;
  const page = 1;
  const totalPages = 16;
  const hasResults = true;
  return (
    <div>
      <h2>Search Results</h2>
      {hasResults ? (
        <div>
          <p>
            Showing results for <strong>{query}</strong> — {total} items found
          </p>
          <div>
            <p>Results would appear here</p>
          </div>
          <nav>
            <span>Page {page} of {totalPages}</span>
            <button>Previous</button>
            <button>Next</button>
          </nav>
        </div>
      ) : (
        <div>
          <p>No results found for <strong>{query}</strong>.</p>
          <p>Try adjusting your search terms or browse our categories.</p>
        </div>
      )}
    </div>
  );
}
