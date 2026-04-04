import { Plural } from 'gt-react';

export default function CommerceCategoryFilter() {
  const categories = [
    { name: 'Clothing', count: 234, subcategories: ['Shirts', 'Pants', 'Jackets'] },
    { name: 'Accessories', count: 89, subcategories: ['Bags', 'Jewelry', 'Watches'] },
  ];
  const priceRange = { min: 0, max: 500 };
  const activeFilters = 3;

  return (
    <aside>
      <header>
        <h3>Filters</h3>
        {activeFilters > 0 && (
          <button>
            Clear all ({activeFilters})
          </button>
        )}
      </header>

      <section>
        <h4>Categories</h4>
        <ul>
          {categories.map((cat) => (
            <li key={cat.name}>
              <label>
                <input type="checkbox" />
                <span>{cat.name}</span>
                <span> (<Plural n={cat.count} one="1 item" other="items" />)</span>
              </label>
              <ul>
                {cat.subcategories.map((sub) => (
                  <li key={sub}>
                    <label>
                      <input type="checkbox" />
                      <span>{sub}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4>Price Range</h4>
        <div>
          <label>Min: ${priceRange.min}</label>
          <label>Max: ${priceRange.max}</label>
        </div>
        <button>Apply filters</button>
      </section>
    </aside>
  );
}
