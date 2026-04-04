export default function CommerceSearchBar() {
  const query = 'wireless headphones';
  const suggestions = ['wireless headphones', 'wireless earbuds', 'wireless speakers'];
  const recentSearches = ['bluetooth speaker', 'usb cable'];
  const isOpen = true;

  return (
    <div>
      <div>
        <label>Search products</label>
        <input type="search" placeholder="Search for products..." value={query} />
        {query && <button aria-label="Clear search">X</button>}
      </div>

      {isOpen && (
        <div>
          {query ? (
            <div>
              <h4>Suggestions</h4>
              <ul>
                {suggestions.map((s) => (
                  <li key={s}>
                    <a href={`/search?q=${s}`}>{s}</a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <h4>Recent Searches</h4>
              <ul>
                {recentSearches.map((s) => (
                  <li key={s}>
                    <a href={`/search?q=${s}`}>{s}</a>
                    <button aria-label="Remove from history">X</button>
                  </li>
                ))}
              </ul>
              <button>Clear search history</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
