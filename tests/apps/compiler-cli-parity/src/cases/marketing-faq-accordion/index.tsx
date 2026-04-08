export default function MarketingFaqAccordion() {
  const faqs = [
    {
      question: 'How does the free trial work?',
      answer: 'You get full access to all features for 14 days. No credit card required. At the end of the trial, you can choose a plan that fits your needs.',
    },
    {
      question: 'Can I cancel my subscription at any time?',
      answer: 'Yes, you can cancel anytime from your account settings. Your access will continue until the end of your current billing period.',
    },
    {
      question: 'Do you offer discounts for startups?',
      answer: 'We offer a 50% discount for early-stage startups with less than $5M in funding. Contact our sales team to learn more.',
    },
    {
      question: 'What kind of support do you offer?',
      answer: 'All plans include email support with a 24-hour response time. Pro and Enterprise plans include priority support with a 2-hour response time during business hours.',
    },
  ];

  return (
    <section>
      <header>
        <h2>Frequently Asked Questions</h2>
        <p>
          Everything you need to know about our platform.
          Can not find the answer you are looking for?{' '}
          <a href="/contact">Contact our support team</a>.
        </p>
      </header>

      <dl>
        {faqs.map((faq, i) => (
          <div key={i}>
            <dt>
              <button>{faq.question}</button>
            </dt>
            <dd>
              <p>{faq.answer}</p>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
