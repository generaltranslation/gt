import { T, Branch, Var, Num, Currency } from "gt-next";
export default function Home() {
  return (
    <T>
      <Branch
        branch="size"
        short="Brief"
        long={`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`}
        mixed={
          <>
            Very long text with <Var>embedded variables</Var> that continues
            for a very long time and includes multiple <Num>{9999999}</Num>{" "}
            numeric values and{" "}
            <Currency currency="USD">{1234567.89}</Currency> monetary amounts
            spread throughout the content to test how the algorithm handles
            very large content blocks with mixed variable types.
          </>
        }
      />
    </T>
  );
}