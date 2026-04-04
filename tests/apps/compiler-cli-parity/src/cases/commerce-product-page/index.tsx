import { Var, Num, Branch, Plural } from 'gt-react';

export default function CommerceProductPage() {
  const product = {
    name: 'Classic Cotton T-Shirt',
    price: 29.99,
    compareAtPrice: 39.99,
    vendor: 'Acme Apparel',
    sku: 'ACM-TSH-001',
    inventoryQuantity: 12,
    description: 'A comfortable everyday essential made from 100% organic cotton.',
  };
  const isOnSale = product.compareAtPrice > product.price;
  const discount = Math.round((1 - product.price / product.compareAtPrice) * 100);
  const selectedColor = 'Navy';
  const selectedSize = 'M';

  return (
    <main>
      <nav>
        <a href="/">Home</a>
        <span> / </span>
        <a href="/collections">Collections</a>
        <span> / </span>
        <span>{product.name}</span>
      </nav>

      <div>
        <div>
          <img src="/product.jpg" alt={product.name} />
        </div>

        <div>
          <p>
            <a href={`/vendors/${product.vendor}`}>{product.vendor}</a>
          </p>
          <h1><Var>{product.name}</Var></h1>

          <div>
            {isOnSale && (
              <span>
                <s>${product.compareAtPrice}</s>
                <span> {discount}% off</span>
              </span>
            )}
            <span>$<Num>{product.price}</Num></span>
          </div>

          <p>{product.description}</p>

          <div>
            <label>Color: <strong>{selectedColor}</strong></label>
            <div>
              <button>White</button>
              <button>Navy</button>
              <button>Black</button>
            </div>
          </div>

          <div>
            <label>Size: <strong>{selectedSize}</strong></label>
            <div>
              <button>XS</button>
              <button>S</button>
              <button>M</button>
              <button>L</button>
              <button>XL</button>
            </div>
          </div>

          <Branch
            branch="stock"
            inStock={<button>Add to Cart</button>}
            lowStock={<button>Add to Cart — Only a few left!</button>}
          >
            <button disabled>Out of Stock</button>
          </Branch>

          <p>
            <Plural
              n={product.inventoryQuantity}
              zero="Out of stock"
              one="Only 1 left in stock"
              other="items in stock"
            />
          </p>

          <details>
            <summary>Shipping and Returns</summary>
            <p>Free shipping on orders over $50. Returns accepted within 30 days.</p>
          </details>

          <p>SKU: {product.sku}</p>
        </div>
      </div>
    </main>
  );
}
