export default function MarketingTestimonials() {
  const testimonials = [
    {
      quote: 'This tool completely transformed our workflow. We shipped 3x faster after adopting it.',
      author: 'Sarah Chen',
      role: 'CTO',
      company: 'TechStartup Inc.',
    },
    {
      quote: 'The best developer experience I have ever had. The docs are incredible and the support team is responsive.',
      author: 'Marcus Rivera',
      role: 'Lead Engineer',
      company: 'ScaleUp Labs',
    },
  ];

  return (
    <section>
      <header>
        <h2>What our customers say</h2>
        <p>
          Thousands of teams trust us to power their development workflow.
        </p>
      </header>

      <div>
        {testimonials.map((t, i) => (
          <blockquote key={i}>
            <p>{t.quote}</p>
            <footer>
              <div>
                <strong>{t.author}</strong>
                <span>
                  {t.role} at {t.company}
                </span>
              </div>
            </footer>
          </blockquote>
        ))}
      </div>

      <div>
        <a href="/case-studies">Read our case studies</a>
      </div>
    </section>
  );
}
