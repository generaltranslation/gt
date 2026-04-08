export default function ProductListing() {
  const category = 'Electronics';
  const resultCount = 42;
  const products = [
    { id: 1, name: 'Laptop', price: 999, rating: 4.5, reviews: 128 },
    { id: 2, name: 'Headphones', price: 79, rating: 4.2, reviews: 56 },
  ];
  return (
    <main>
      <header>
        <h1>{category}</h1>
        <p>Showing {resultCount} results</p>
      </header>
      <div>
        {products.map((p) => (
          <article key={p.id}>
            <img src={`/img/${p.id}.jpg`} alt={p.name} />
            <div>
              <h3>{p.name}</h3>
              <p>${p.price}</p>
              <div>
                <span>{p.rating} stars</span>
                <span> ({p.reviews} reviews)</span>
              </div>
              <button>Add to Cart</button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
