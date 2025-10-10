import { Branch, T } from "gt-next";

export default function Home() {
  return (
    <T
      placeholder="Enter text"
      title="Tooltip text"
      alt="Alt text"
    >
      <Branch
        branch="element"
        input={
          <input placeholder="Branch placeholder" title="Branch title" />
        }
        image={
          <img src="test.jpg" alt="Branch image" title="Branch image title" />
        }
        link={
          <a href="#" aria-label="Branch link" aria-describedby="desc">
            Link
          </a>
        }
      />
    </T>
  );
}