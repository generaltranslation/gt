import { Plural, Num } from 'gt-react';

export default function CommerceWishlist() {
  const items = [
    { id: 1, name: 'Leather Jacket', price: 299.99, inStock: true },
    { id: 2, name: 'Silk Scarf', price: 49.99, inStock: false },
  ];
  const totalItems = items.length;

  return (
    <main>
      <header>
        <h1>My Wishlist</h1>
        <p>
          <Plural n={totalItems} zero="No saved items" one="1 saved item" other="saved items" />
        </p>
      </header>

      {items.length === 0 ? (
        <div>
          <p>Your wishlist is empty.</p>
          <p>Browse our collections and save items you love.</p>
          <a href="/collections">Start shopping</a>
        </div>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <h3>{item.name}</h3>
                <p>$<Num>{item.price}</Num></p>
                {item.inStock ? (
                  <div>
                    <span>In stock</span>
                    <button>Add to cart</button>
                  </div>
                ) : (
                  <div>
                    <span>Out of stock</span>
                    <button>Notify me</button>
                  </div>
                )}
                <button>Remove from wishlist</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
