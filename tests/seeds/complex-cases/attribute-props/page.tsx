import { Select, T } from "gt-next";

export default function Home() {
  return (
    <T
      placeholder="Enter text"
      title="Tooltip text"
      alt="Alt text"
    >
      <Select
        value="element"
        input={
          <input placeholder="Select placeholder" title="Select title" />
        }
        image={
          <img src="test.jpg" alt="Select image" title="Select image title" />
        }
        link={
          <a href="#" aria-label="Select link" aria-describedby="desc">
            Link
          </a>
        }
      />
    </T>
  );
}