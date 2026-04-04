import { Plural, Num } from 'gt-react';

export default function CommerceReviewList() {
  const reviews = [
    { id: 1, author: 'Sarah K.', rating: 5, title: 'Amazing quality!', body: 'Best purchase I have made this year.', date: 'Feb 12, 2024', helpful: 23 },
    { id: 2, author: 'Mike T.', rating: 4, title: 'Good but runs small', body: 'Great material but order a size up.', date: 'Jan 28, 2024', helpful: 8 },
  ];
  const averageRating = 4.5;
  const totalReviews = 147;

  return (
    <section>
      <header>
        <h2>Customer Reviews</h2>
        <div>
          <span>{averageRating} out of 5 stars</span>
          <span> — </span>
          <span>
            Based on <Num>{totalReviews}</Num>{' '}
            <Plural n={totalReviews} one="review" other="reviews" />
          </span>
        </div>
      </header>

      <div>
        <label>Sort by</label>
        <select>
          <option>Most recent</option>
          <option>Highest rated</option>
          <option>Most helpful</option>
        </select>
      </div>

      <ul>
        {reviews.map((review) => (
          <li key={review.id}>
            <header>
              <div>
                <strong>{review.author}</strong>
                <span> — </span>
                <span>{review.rating} stars</span>
              </div>
              <time>{review.date}</time>
            </header>
            <h3>{review.title}</h3>
            <p>{review.body}</p>
            <footer>
              <button>
                Helpful ({review.helpful})
              </button>
              <button>Report</button>
            </footer>
          </li>
        ))}
      </ul>

      <button>Load more reviews</button>
    </section>
  );
}
