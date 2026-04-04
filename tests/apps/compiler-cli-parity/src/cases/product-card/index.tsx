export default function ProductCard() {
  const price = 29.99;
  const name = 'Widget';
  return (
    <div>
      <img src="product.jpg" alt="Product" />
      <h3>{name}</h3>
      <p>Price: ${price}</p>
      <button>Add to cart</button>
    </div>
  );
}
